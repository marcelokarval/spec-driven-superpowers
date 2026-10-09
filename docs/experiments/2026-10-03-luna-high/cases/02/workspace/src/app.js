export function listOrders(orders) { return [...orders]; }
export function renderOrders(orders) { return listOrders(orders).map(x => `${x.id}: ${x.status}`).join('\n'); }
