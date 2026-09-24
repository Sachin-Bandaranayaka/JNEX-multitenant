'use client';

import Link from 'next/link';
import Barcode from 'react-barcode';
import { useState } from 'react';
import { shipmentPrintFormats } from './shipment-batch-list';

type Format = typeof shipmentPrintFormats[number][0];
type Parcel = { id: string; number: number; customerName: string; customerPhone: string; customerSecondPhone: string | null; customerAddress: string; customerCity: string; productName: string; quantity: number; cod: number; trackingNumber: string };
type Sender = { name: string; address: string; phone: string };
const formatKeys = shipmentPrintFormats.map(([key]) => key);
const currency = (value: number) => `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
const courier = (provider: string) => provider.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

function Tracking({ number }: { number: string }) { return <div className="tracking"><Barcode value={number || 'NO-TRACKING'} format="CODE128" width={1.35} height={35} fontSize={10} margin={0} displayValue /></div>; }
function Party({ label, name, address, phone }: { label: string; name: string; address: string; phone: string }) { return <div className="party"><strong>{label}</strong><span>{name}</span><span>{address}</span><span>{phone}</span></div>; }
function Label({ parcel, sender, provider, format }: { parcel: Parcel; sender: Sender; provider: string; format: Format }) {
  const recipient = <Party label="TO" name={parcel.customerName} address={`${parcel.customerAddress}, ${parcel.customerCity}`} phone={[parcel.customerPhone, parcel.customerSecondPhone].filter(Boolean).join(' / ')} />;
  const from = <Party label="FROM" name={sender.name} address={sender.address} phone={sender.phone} />;
  const goods = <div className="goods">{parcel.productName} × {parcel.quantity}</div>;
  const cod = <div className="cod">COD {currency(parcel.cod)}</div>;
  const barcode = <Tracking number={parcel.trackingNumber} />;
  if (format === 'dense') return <article className="parcel dense"><header>{courier(provider)} · COD <small>ORDER #{parcel.number}</small></header><div className="two">{from}{recipient}</div><div className="two bottom">{barcode}{cod}</div>{goods}</article>;
  if (format === 'cod-two') return <article className="parcel codTwo"><header>COD WAYBILL <small>#{parcel.number}</small></header><div className="two">{recipient}<div>{cod}{goods}</div></div><div className="two bottom">{from}{barcode}</div><footer>PLEASE HANDLE WITH CARE · DO NOT OPEN BEFORE PAYMENT</footer></article>;
  if (format === 'cod-three') return <article className="parcel codThree"><header>COD WAYBILL · {courier(provider)}</header><small>ORDER #{parcel.number}</small>{recipient}{from}{goods}{barcode}{cod}</article>;
  if (format === 'large') return <article className="parcel large"><header>{courier(provider)}</header>{from}<hr />{recipient}{barcode}{cod}</article>;
  if (format === 'plain') return <article className="parcel plain"><header>DELIVERY SLIP · #{parcel.number}</header>{from}<hr />{recipient}{goods}{barcode}{cod}</article>;
  return <article className="parcel standard"><div className="two">{from}{recipient}</div><div className="two bottom">{barcode}<div>{goods}{cod}<small>Order #{parcel.number} · {courier(provider)}</small></div></div></article>;
}

export function ShipmentPrint({ batchId, provider, format: initialFormat, sender, orders }: { batchId: string; provider: string; format: string; sender: Sender; orders: Parcel[] }) {
  const [format, setFormat] = useState<Format>(formatKeys.includes(initialFormat as Format) ? initialFormat as Format : 'standard');
  return <div className="shipment-print-root"><style>{`
    .shipment-print-root{color:#111}.shipment-print-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:16px}.shipment-print-toolbar select,.shipment-print-toolbar button,.shipment-print-toolbar a{border:1px solid #cbd5e1;border-radius:4px;padding:8px 12px;background:#fff;font-size:14px}.shipment-print-toolbar button{background:#2563a6;color:white;border-color:#2563a6}.sheet{background:white;color:black;border:1px solid #ddd;box-shadow:0 8px 25px #0002;min-height:190mm;margin:auto;padding:8mm;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:4mm}.sheet.three{grid-template-columns:repeat(3,minmax(0,1fr))}.parcel{break-inside:avoid;page-break-inside:avoid;padding:3mm;min-height:47mm;font-family:Arial,sans-serif;font-size:11px;line-height:1.23;overflow-wrap:anywhere}.parcel header{font-weight:700;font-size:13px;letter-spacing:.3px;margin-bottom:2mm}.parcel header small{float:right;font-weight:400}.parcel .two{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.parcel .party{display:flex;flex-direction:column}.parcel .party strong{font-size:10px}.parcel .bottom{margin-top:2mm;align-items:start}.parcel .goods{font-weight:600;margin:1mm 0}.parcel .cod{font-weight:800;font-size:15px;margin:2mm 0}.parcel .tracking svg{max-width:100%;height:auto}.parcel small{font-size:9px}.parcel.standard{border:0;border-bottom:1px dashed #888}.parcel.standard .two:first-child .party+ .party,.parcel.standard .bottom>div+div{border-left:1px solid #555;padding-left:3mm}.parcel.dense{border:1px dashed #555}.parcel.dense .two:first-of-type .party+ .party{border-left:1px dashed #777;padding-left:3mm}.parcel.codTwo{border:1px solid #111}.parcel.codTwo footer{font-size:9px;border-top:1px solid #111;margin-top:2mm;padding-top:1mm}.parcel.codThree{border:1px solid #111;min-height:75mm}.parcel.codThree .party{border-top:1px solid #888;padding-top:1mm;margin-top:1mm}.parcel.codThree .cod{border-top:1px solid #111}.parcel.large{min-height:75mm;border-bottom:1px solid #777}.parcel.large header{font-size:17px}.parcel.large .party{margin:2mm 0}.parcel.large .party:nth-of-type(2){font-size:14px}.parcel.plain{min-height:75mm}.parcel.plain .party{margin:2mm 0}.sheet.three .parcel{font-size:9px}.sheet.three .parcel .cod{font-size:12px}
    @media screen{.shipment-print-root{padding:12px}.sheet{width:min(100%,297mm)}.shipment-print-root h1{font-size:24px;font-weight:700;margin-bottom:12px}}
    @media print{@page{size:A4 landscape;margin:6mm}body{background:white!important}.jnex-workspace,.jnex-workspace>div,.jnex-workspace main{display:block!important;min-height:0!important;overflow:visible!important}.jnex-workspace main{padding:0!important}.jnex-workspace nav[aria-label="Shipping sections"]{display:none!important}.shipment-print-root{padding:0!important}.shipment-print-root h1,.shipment-print-toolbar,.shipment-print-note{display:none!important}.sheet{width:auto!important;min-height:0;border:0;box-shadow:none;padding:0;gap:3mm}.parcel{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  `}</style><h1>Print shipment labels</h1><div className="shipment-print-toolbar"><Link href={`/shipping/batches/${batchId}`}>← Back to batch</Link><label>Document type&nbsp; <select value={format} onChange={event => setFormat(event.target.value as Format)}>{shipmentPrintFormats.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><button type="button" onClick={() => window.print()}>Print</button></div><p className="shipment-print-note" style={{ marginBottom: 12, fontSize: 13 }}>Batch {batchId.slice(-8).toUpperCase()} · {courier(provider)} · {orders.length} parcels · A4 landscape</p><div className={`sheet ${format === 'cod-three' ? 'three' : ''}`}>{orders.map(order => <Label key={order.id} parcel={order} sender={sender} provider={provider} format={format} />)}</div></div>;
}
