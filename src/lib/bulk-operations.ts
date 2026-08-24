import { prisma } from './prisma';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { z } from 'zod';
import { Buffer as NodeBuffer } from 'buffer';
import { Prisma } from '@prisma/client';

// Schema for product validation
const ProductSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  lowStockAlert: z.number().int().min(0),
  unit: z.string(),
  brand: z.string().optional(),
  supplier: z.string().optional(),
});

type ProductImport = z.infer<typeof ProductSchema>;

interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failedRows: Array<{
    row: number;
    errors: string[];
    data: any;
  }>;
}

export async function importProductsFromExcel(
  buffer: NodeBuffer,
  tenantId: string
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in the Excel file');
  }

  const result: ImportResult = {
    success: true,
    totalRows: 0,
    successCount: 0,
    failedRows: [],
  };

  // Get headers from the first row
  const headers = worksheet.getRow(1).values as string[];
  const columnMap = createColumnMap(headers);

  // Process each row
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowData = mapRowToProduct(row, columnMap);
    result.totalRows++;

    try {
      // Validate the product data
      const validatedData = ProductSchema.parse(rowData);

      // Check if product with same code exists
      const existingProduct = await prisma.product.findUnique({
        where: { code_tenantId: { code: validatedData.code, tenantId: tenantId } },
      });

      if (existingProduct) {
        // Update existing product
        const productData: Prisma.ProductUpdateInput = {
          name: validatedData.name,
          description: validatedData.description,
          price: validatedData.price,
          lowStockAlert: validatedData.lowStockAlert,
        };

        await prisma.product.update({
          where: { code_tenantId: { code: validatedData.code, tenantId: tenantId } },
          data: productData,
        });
      } else {
        // Create new product
        const productData: Prisma.ProductCreateInput = {
          code: validatedData.code,
          name: validatedData.name,
          description: validatedData.description,
          price: validatedData.price,
          stock: 0,
          lowStockAlert: validatedData.lowStockAlert,
          tenant: {
            connect: { id: tenantId },
          },
        };

        await prisma.product.create({
          data: {
            ...productData,
            tenant: {
              connect: { id: tenantId },
            },
          },
        });
      }

      result.successCount++;
    } catch (error) {
      result.success = false;
      result.failedRows.push({
        row: rowNumber,
        errors: error instanceof z.ZodError
          ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          : [(error as Error).message],
        data: rowData,
      });
    }
  }

  return result;
}

export async function importProductsFromCSV(
  csvContent: string,
  tenantId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    successCount: 0,
    failedRows: [],
  };

  const { data } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  for (let i = 0; i < data.length; i++) {
    const rowData = normalizeProductData(data[i]);
    result.totalRows++;

    try {
      const validatedData = ProductSchema.parse(rowData);

      const existingProduct = await prisma.product.findUnique({
        where: { code_tenantId: { code: validatedData.code, tenantId: tenantId } },
      });

      if (existingProduct) {
        const productData: Prisma.ProductUpdateInput = {
          name: validatedData.name,
          description: validatedData.description,
          price: validatedData.price,
          lowStockAlert: validatedData.lowStockAlert,
        };

        await prisma.product.update({
          where: { code_tenantId: { code: validatedData.code, tenantId: tenantId } },
          data: productData,
        });
      } else {
        const productData: Prisma.ProductCreateInput = {
          code: validatedData.code,
          name: validatedData.name,
          description: validatedData.description,
          price: validatedData.price,
          stock: 0,
          lowStockAlert: validatedData.lowStockAlert,
          tenant: {
            connect: { id: tenantId },
          },
        };

        await prisma.product.create({
          data: {
            ...productData,
            tenant: {
              connect: { id: tenantId },
            },
          },
        });
      }

      result.successCount++;
    } catch (error) {
      result.success = false;
      result.failedRows.push({
        row: i + 2, // Adding 2 to account for 1-based index and header row
        errors: error instanceof z.ZodError
          ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          : [(error as Error).message],
        data: rowData,
      });
    }
  }

  return result;
}

export async function exportProductsToExcel(tenantId: string): Promise<NodeBuffer> {
  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { code: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');

  // Define columns
  worksheet.columns = [
    { header: 'Code', key: 'code', width: 15 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Price', key: 'price', width: 15 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Low Stock Alert', key: 'lowStockAlert', width: 15 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Brand', key: 'brand', width: 20 },
    { header: 'Supplier', key: 'supplier', width: 20 },
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add products data
  worksheet.addRows(products);

  // Apply number format to price column
  worksheet.getColumn('price').numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as NodeBuffer;
}

export async function exportProductsToCSV(tenantId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { code: 'asc' },
  });

  return Papa.unparse(products);
}

// Helper functions
function createColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key) {
      map[key] = index + 1; // Excel columns are 1-based
    }
  });
  return map;
}

function mapRowToProduct(
  row: ExcelJS.Row,
  columnMap: Record<string, number>
): ProductImport {
  return {
    code: getCellValue(row, columnMap.code),
    name: getCellValue(row, columnMap.name),
    description: getCellValue(row, columnMap.description),
    category: getCellValue(row, columnMap.category),
    price: Number(getCellValue(row, columnMap.price)),
    stock: Number(getCellValue(row, columnMap.stock)),
    lowStockAlert: Number(getCellValue(row, columnMap.lowstockalert)),
    unit: getCellValue(row, columnMap.unit),
    brand: getCellValue(row, columnMap.brand),
    supplier: getCellValue(row, columnMap.supplier),
  };
}

function getCellValue(row: ExcelJS.Row, columnNumber: number): any {
  const cell = row.getCell(columnNumber);
  return cell.value;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeProductData(data: any): ProductImport {
  return {
    code: String(data.code || ''),
    name: String(data.name || ''),
    description: data.description ? String(data.description) : undefined,
    category: String(data.category || ''),
    price: Number(data.price || 0),
    stock: Number(data.stock || 0),
    lowStockAlert: Number(data.lowStockAlert || 0),
    unit: String(data.unit || ''),
    brand: data.brand ? String(data.brand) : undefined,
    supplier: data.supplier ? String(data.supplier) : undefined,
  };
}
