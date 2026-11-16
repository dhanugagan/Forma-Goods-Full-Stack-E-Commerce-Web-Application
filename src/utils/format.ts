export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export const STUDIO_IMAGE_PRESETS = [
  {
    label: 'Task Lamp (Studio)',
    url: '/src/assets/images/product_task_lamp_1794845502286.jpg',
  },
  {
    label: 'Stoneware Pour-Over',
    url: '/src/assets/images/product_ceramic_carafe_1794845503488.jpg',
  },
  {
    label: 'Walnut Valet Tray',
    url: '/src/assets/images/product_walnut_tray_1794845503628.jpg',
  },
  {
    label: 'Machined Brass Pen',
    url: '/src/assets/images/product_brass_pen_1794845503338.jpg',
  },
  {
    label: 'Belgian Linen Throw',
    url: '/src/assets/images/product_linen_throw_1794845503751.jpg',
  },
  {
    label: 'Steel Desk Clock',
    url: '/src/assets/images/product_desk_clock_1794845505217.jpg',
  },
];
