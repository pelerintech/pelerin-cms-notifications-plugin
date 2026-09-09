import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderTemplate } from '../src/lib/render.ts';
import {
  CONFIRMED_TEMPLATE,
  SHIPPED_TEMPLATE,
  CANCELLED_TEMPLATE,
} from './fixtures/order-templates.ts';

function deliveryPayload() {
  return {
    data: {
      order: {
        order_number: 'ORD-123',
        customer_name: 'Ana',
        total: 1250,
        currency: 'RON',
        created_at: '2026-07-24T10:00:00.000Z',
        metadata: null,
      },
      billing_address: {
        first_name: 'Ana',
        last_name: 'Popescu',
        address: '1 Main',
        city: 'Cluj',
        country: 'RO',
      },
      shipping_address: {
        first_name: 'Ana',
        last_name: 'Popescu',
        address: '12 Oak St',
        city: 'Cluj',
        country: 'RO',
      },
      items: [{ product_name: 'A', sku: 'S1', quantity: 2, price_gross: 500, currency: 'RON' }],
    },
  };
}

function pickupPayload() {
  return {
    data: {
      order: {
        order_number: 'ORD-456',
        customer_name: 'Ana',
        total: 999,
        currency: 'RON',
        created_at: '2026-07-24T10:00:00.000Z',
        metadata: {
          pickup_location: {
            collectionItemId: 'loc-1',
            name: 'Sediu',
            address: '1 Main St',
            city: 'Cluj',
          },
        },
      },
      billing_address: {
        first_name: 'Ana',
        last_name: 'Popescu',
        address: '1 Main',
        city: 'Cluj',
        country: 'RO',
      },
      shipping_address: {
        first_name: 'Ana',
        last_name: 'Popescu',
        address: '12 Oak St',
        city: 'Cluj',
        country: 'RO',
      },
      items: [{ product_name: 'A', sku: 'S1', quantity: 2, price_gross: 500, currency: 'RON' }],
    },
  };
}

describe('confirmed template', () => {
  it('renders order number, customer name, formatted total and shipping address for delivery', () => {
    const out = renderTemplate(CONFIRMED_TEMPLATE.body_html, deliveryPayload());
    assert.ok(out.includes('ORD-123'), 'should include order number');
    assert.ok(out.includes('Ana'), 'should include customer name');
    assert.ok(out.includes('1.250,00 RON'), 'should include formatted total');
    assert.ok(out.includes('12 Oak St'), 'should include shipping address');
    assert.ok(!out.includes('Sediu'), 'delivery should not name a pickup location');
  });

  it('renders pickup location copy for a pickup order', () => {
    const out = renderTemplate(CONFIRMED_TEMPLATE.body_html, pickupPayload());
    assert.ok(out.includes('Sediu'), 'should name the pickup location');
  });

  it('iterates line items via {{#each}} (product name, sku, qty, price)', () => {
    const out = renderTemplate(CONFIRMED_TEMPLATE.body_html, deliveryPayload());
    assert.ok(out.includes('S1'), 'should render the item sku');
    assert.match(out, /A/, 'should render the item product name');
    assert.match(out, /2/, 'should render the item quantity');
    assert.ok(out.includes('500,00 RON'), 'should render the item gross price via formatMoney');
  });

  it('omits the line-items block when there are no items', () => {
    const noItems = deliveryPayload();
    noItems.data.items = [];
    const out = renderTemplate(CONFIRMED_TEMPLATE.body_html, noItems);
    assert.ok(out.includes('ORD-123'), 'order still renders');
    assert.ok(!out.includes('S1'), 'no item rows when no items');
  });
});

describe('shipped template', () => {
  it('mentions order number and shipping address, staying simple', () => {
    const out = renderTemplate(SHIPPED_TEMPLATE.body_html, deliveryPayload());
    assert.ok(out.includes('ORD-123'));
    assert.match(out, /12 Oak St/);
  });
});

describe('cancelled template', () => {
  it('states the order number was cancelled (simplest)', () => {
    const out = renderTemplate(CANCELLED_TEMPLATE.body_html, deliveryPayload());
    assert.ok(out.includes('ORD-123'));
    assert.match(out, /cancelled/i);
  });
});
