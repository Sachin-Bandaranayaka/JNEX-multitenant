'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCartIcon, 
  PlusIcon, 
  MinusIcon,
  ShoppingBagIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  CheckIcon,
  TagIcon,
  EyeIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  sku: string;
  imageUrl: string | null;
}

interface StoreClientProps {
  initialProducts: StoreProduct[];
  initialCartCount: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-desc';
type ViewMode = 'grid' | 'list';

export function StoreClient({ initialProducts, initialCartCount }: StoreClientProps) {
  const [products] = useState<StoreProduct[]>(initialProducts);
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low-stock'>('all');
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  const getQuantity = (productId: string) => quantities[productId] || 1;

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 1;
      const newQty = Math.max(1, current + delta);
      return { ...prev, [productId]: newQty };
    });
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
        toast.success('Removed from favorites');
      } else {
        newFavorites.add(productId);
        toast.success('Added to favorites');
      }
      return newFavorites;
    });
  };

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (product.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStock = stockFilter === 'all' ||
                          (stockFilter === 'in-stock' && product.stock > 0) ||
                          (stockFilter === 'low-stock' && product.stock > 0 && product.stock <= 10);
      
      return matchesSearch && matchesStock;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'stock-desc': return b.stock - a.stock;
        default: return 0;
      }
    });
  }, [products, searchQuery, sortBy, stockFilter]);

  const addToCart = async (productId: string, productName: string) => {
    setAddingToCart(productId);
    try {
      const response = await fetch('/api/store/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeProductId: productId,
          quantity: getQuantity(productId),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to cart');
      }

      const qty = getQuantity(productId);
      setCartCount(prev => prev + qty);
      setQuantities(prev => ({ ...prev, [productId]: 1 }));
      setRecentlyAdded(productId);
      setTimeout(() => setRecentlyAdded(null), 2000);
      
      toast.success(`${qty}x ${productName} added to cart`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add to cart');
    } finally {
      setAddingToCart(null);
    }
  };

  const inStockCount = products.filter(p => p.stock > 0).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 10).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
              <ShoppingBagIcon className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Store</h1>
              <p className="text-sm text-muted-foreground">
                {filteredAndSortedProducts.length} products available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store/purchases"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:border-accent transition-all duration-200"
            >
              <TagIcon className="h-4 w-4" />
              My Purchases
            </Link>
            <Link
              href="/store/cart"
              className="relative inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              Cart
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground ring-2 ring-background"
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <XMarkIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 ${
              showFilters || stockFilter !== 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-accent'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 cursor-pointer"
          >
            <option value="name-asc">Name: A-Z</option>
            <option value="name-desc">Name: Z-A</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="stock-desc">Stock: High to Low</option>
          </select>

          <div className="flex rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-3 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
                <div className="flex flex-wrap gap-3">
                  <span className="text-sm font-medium text-muted-foreground self-center">Stock:</span>
                  {[
                    { value: 'all', label: 'All Products', count: products.length },
                    { value: 'in-stock', label: 'In Stock', count: inStockCount },
                    { value: 'low-stock', label: 'Low Stock', count: lowStockCount },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setStockFilter(filter.value as typeof stockFilter)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        stockFilter === filter.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {filter.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        stockFilter === filter.value ? 'bg-primary-foreground/20' : 'bg-background'
                      }`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products */}
        {filteredAndSortedProducts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-5 rounded-full bg-muted/50 mb-5">
              <ShoppingBagIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? 'No products found' : 'No products available'}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {searchQuery 
                ? `We couldn't find any products matching "${searchQuery}". Try a different search term.`
                : 'Check back later for new products.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Clear Search
              </button>
            )}
          </motion.div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredAndSortedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  quantity={getQuantity(product.id)}
                  onUpdateQuantity={(delta) => updateQuantity(product.id, delta)}
                  onAddToCart={() => addToCart(product.id, product.name)}
                  isAdding={addingToCart === product.id}
                  isRecentlyAdded={recentlyAdded === product.id}
                  isFavorite={favorites.has(product.id)}
                  onToggleFavorite={() => toggleFavorite(product.id)}
                  onQuickView={() => setSelectedProduct(product)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredAndSortedProducts.map((product, index) => (
                <ProductListItem
                  key={product.id}
                  product={product}
                  index={index}
                  quantity={getQuantity(product.id)}
                  onUpdateQuantity={(delta) => updateQuantity(product.id, delta)}
                  onAddToCart={() => addToCart(product.id, product.name)}
                  isAdding={addingToCart === product.id}
                  isRecentlyAdded={recentlyAdded === product.id}
                  isFavorite={favorites.has(product.id)}
                  onToggleFavorite={() => toggleFavorite(product.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <QuickViewModal
            product={selectedProduct}
            quantity={getQuantity(selectedProduct.id)}
            onUpdateQuantity={(delta) => updateQuantity(selectedProduct.id, delta)}
            onAddToCart={() => {
              addToCart(selectedProduct.id, selectedProduct.name);
              setSelectedProduct(null);
            }}
            isAdding={addingToCart === selectedProduct.id}
            onClose={() => setSelectedProduct(null)}
            isFavorite={favorites.has(selectedProduct.id)}
            onToggleFavorite={() => toggleFavorite(selectedProduct.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


// Product Card Component (Grid View)
function ProductCard({
  product,
  index,
  quantity,
  onUpdateQuantity,
  onAddToCart,
  isAdding,
  isRecentlyAdded,
  isFavorite,
  onToggleFavorite,
  onQuickView,
}: {
  product: StoreProduct;
  index: number;
  quantity: number;
  onUpdateQuantity: (delta: number) => void;
  onAddToCart: () => void;
  isAdding: boolean;
  isRecentlyAdded: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onQuickView: () => void;
}) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      className={`group relative rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 ${
        isRecentlyAdded ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''
      }`}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <PhotoIcon className="h-20 w-20 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Top Actions */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="p-2 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm shadow-lg hover:scale-110 transition-transform"
          >
            {isFavorite ? (
              <HeartSolidIcon className="h-5 w-5 text-red-500" />
            ) : (
              <HeartIcon className="h-5 w-5 text-foreground" />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onQuickView(); }}
            className="p-2 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm shadow-lg hover:scale-110 transition-transform"
          >
            <EyeIcon className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Stock Badge */}
        <div className="absolute top-3 left-3">
          {isOutOfStock ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500 text-white shadow-lg">
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-lg">
              Only {product.stock} left
            </span>
          ) : null}
        </div>

        {/* Recently Added Indicator */}
        <AnimatePresence>
          {isRecentlyAdded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm"
            >
              <div className="p-3 rounded-full bg-green-500 text-white">
                <CheckIcon className="h-8 w-8" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-3">
          <p className="text-xs text-muted-foreground font-mono mb-1">{product.sku}</p>
          <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="text-2xl font-bold text-foreground">
              LKR {product.price.toLocaleString()}
            </span>
          </div>
          {!isOutOfStock && (
            <span className="text-xs text-muted-foreground">
              {product.stock} available
            </span>
          )}
        </div>

        {!isOutOfStock && (
          <div className="space-y-3">
            {/* Quantity Selector */}
            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-1">
              <button
                onClick={() => onUpdateQuantity(-1)}
                disabled={quantity <= 1}
                className="p-2 rounded-lg hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <span className="font-semibold text-foreground min-w-[3rem] text-center">
                {quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(1)}
                disabled={quantity >= product.stock}
                className="p-2 rounded-lg hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={onAddToCart}
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
            >
              {isAdding ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  />
                  Adding...
                </>
              ) : (
                <>
                  <ShoppingCartIcon className="h-4 w-4" />
                  Add to Cart
                </>
              )}
            </button>
          </div>
        )}

        {isOutOfStock && (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed"
          >
            Out of Stock
          </button>
        )}
      </div>
    </motion.div>
  );
}


// Product List Item Component (List View)
function ProductListItem({
  product,
  index,
  quantity,
  onUpdateQuantity,
  onAddToCart,
  isAdding,
  isRecentlyAdded,
  isFavorite,
  onToggleFavorite,
}: {
  product: StoreProduct;
  index: number;
  quantity: number;
  onUpdateQuantity: (delta: number) => void;
  onAddToCart: () => void;
  isAdding: boolean;
  isRecentlyAdded: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.02 }}
      className={`group flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-card border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-300 ${
        isRecentlyAdded ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''
      }`}
    >
      {/* Image */}
      <div className="relative w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-muted flex-shrink-0">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <PhotoIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
              <h3 className="font-semibold text-foreground text-lg">{product.name}</h3>
            </div>
            <button
              onClick={onToggleFavorite}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              {isFavorite ? (
                <HeartSolidIcon className="h-5 w-5 text-red-500" />
              ) : (
                <HeartIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {isLowStock && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                Only {product.stock} left
              </span>
            )}
            {!isOutOfStock && !isLowStock && (
              <span className="text-xs text-muted-foreground">
                {product.stock} in stock
              </span>
            )}
          </div>
        </div>

        {/* Price and Actions */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 sm:min-w-[200px]">
          <span className="text-2xl font-bold text-foreground">
            LKR {product.price.toLocaleString()}
          </span>
          
          {!isOutOfStock && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/50 rounded-lg">
                <button
                  onClick={() => onUpdateQuantity(-1)}
                  disabled={quantity <= 1}
                  className="p-2 hover:bg-muted disabled:opacity-40 rounded-l-lg transition-colors"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <span className="px-3 font-medium">{quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(1)}
                  disabled={quantity >= product.stock}
                  className="p-2 hover:bg-muted disabled:opacity-40 rounded-r-lg transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={onAddToCart}
                disabled={isAdding}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isAdding ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  />
                ) : (
                  <ShoppingCartIcon className="h-4 w-4" />
                )}
                {isAdding ? 'Adding...' : 'Add'}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}


// Quick View Modal Component
function QuickViewModal({
  product,
  quantity,
  onUpdateQuantity,
  onAddToCart,
  isAdding,
  onClose,
  isFavorite,
  onToggleFavorite,
}: {
  product: StoreProduct;
  quantity: number;
  onUpdateQuantity: (delta: number) => void;
  onAddToCart: () => void;
  isAdding: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-auto bg-card rounded-3xl shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <PhotoIcon className="h-24 w-24 text-muted-foreground/30" />
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-red-500 text-white">
                  Out of Stock
                </span>
              </div>
            )}
            {isLowStock && (
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-500 text-white">
                  Only {product.stock} left
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-mono mb-2">{product.sku}</p>
              <h2 className="text-2xl font-bold text-foreground mb-4">{product.name}</h2>
              
              {product.description && (
                <p className="text-muted-foreground mb-6">{product.description}</p>
              )}

              <div className="flex items-center justify-between mb-6">
                <span className="text-3xl font-bold text-foreground">
                  LKR {product.price.toLocaleString()}
                </span>
                <button
                  onClick={onToggleFavorite}
                  className="p-3 rounded-full hover:bg-muted transition-colors"
                >
                  {isFavorite ? (
                    <HeartSolidIcon className="h-6 w-6 text-red-500" />
                  ) : (
                    <HeartIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>
              </div>

              {!isOutOfStock && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Quantity
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-muted rounded-xl">
                        <button
                          onClick={() => onUpdateQuantity(-1)}
                          disabled={quantity <= 1}
                          className="p-3 hover:bg-muted/80 disabled:opacity-40 rounded-l-xl transition-colors"
                        >
                          <MinusIcon className="h-5 w-5" />
                        </button>
                        <span className="px-6 font-semibold text-lg">{quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(1)}
                          disabled={quantity >= product.stock}
                          className="p-3 hover:bg-muted/80 disabled:opacity-40 rounded-r-xl transition-colors"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {product.stock} available
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-xl font-bold text-foreground">
                        LKR {(product.price * quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              {!isOutOfStock ? (
                <button
                  onClick={onAddToCart}
                  disabled={isAdding}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/20"
                >
                  {isAdding ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                      />
                      Adding to Cart...
                    </>
                  ) : (
                    <>
                      <ShoppingCartIcon className="h-5 w-5" />
                      Add to Cart
                    </>
                  )}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-muted px-6 py-4 text-base font-medium text-muted-foreground cursor-not-allowed"
                >
                  Out of Stock
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
