/**
 * Customer-facing order notification templates (documented content).
 *
 * These are templates authored for a shop that fulfils orders via both
 * delivery and store pickup. They are the reference content for the admin to
 * create `notification_templates` rows and the rules that bind them to the
 * ecomm `shop.order.confirmed` / `shop.order.shipped` / `shop.order.cancelled`
 * events.
 *
 * Syntax: Handlebars. `{{ field.path }}` is HTML-escaped; `{{{ }}}` is raw.
 * Pickup vs delivery branches on `data.order.metadata.pickup_location`
 * (surfaced as an object by the ecomm `buildOrderEventPayload` change).
 *
 * The HTML bodies use table-based, inline-styled markup (no JS, no external
 * CSS, no flex/div-heavy layouts) for email-client compatibility.
 */

export interface TemplateContent {
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
}

export const CONFIRMED_TEMPLATE: TemplateContent = {
  name: 'Order Confirmed',
  subject: 'Order {{ data.order.order_number }} confirmed',
  body_html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">
  <tr>
    <td style="padding:16px;">
      <p>Hi {{ data.order.customer_name }},</p>
      <p>Thank you for your order. Your order <strong>{{ data.order.order_number }}</strong> has been received.</p>
      <p><strong>Total:</strong> {{ formatMoney data.order.total data.order.currency }}</p>
      <p><strong>Date:</strong> {{ formatDate data.order.created_at 'dd/MM/yy' }}</p>
      {{#if data.items}}
      <table role="presentation" width="100%" cellpadding="4" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
        {{#each data.items}}
        <tr>
          <td>{{ product_name }} ({{ sku }})</td>
          <td align="right">{{ quantity }}x</td>
          <td align="right">{{ formatMoney price_gross currency }}</td>
        </tr>
        {{/each}}
      </table>
      {{/if}}
      {{#if data.order.metadata.pickup_location}}
      <p><strong>Pickup:</strong> Your order will be ready for pickup at <strong>{{ data.order.metadata.pickup_location.name }}</strong>{{#if data.order.metadata.pickup_location.address}}, {{ data.order.metadata.pickup_location.address }}{{/if}}.</p>
      {{else}}
      <p><strong>Shipping to:</strong> {{ data.shipping_address.address }}, {{ data.shipping_address.city }}, {{ data.shipping_address.country }}</p>
      {{/if}}
      <p>We'll email you once your order ships.</p>
    </td>
  </tr>
</table>`,
  body_text:
    'Hi {{ data.order.customer_name }},\n' +
    'Thank you for your order. Your order {{ data.order.order_number }} has been received.\n' +
    'Total: {{ formatMoney data.order.total data.order.currency }}\n' +
    '{{#if data.order.metadata.pickup_location}}Pickup: ready at {{ data.order.metadata.pickup_location.name }}{{else}}Shipping to: {{ data.shipping_address.address }}, {{ data.shipping_address.city }}{{/if}}\n' +
    "We'll email you once your order ships.",
};

export const SHIPPED_TEMPLATE: TemplateContent = {
  name: 'Order Shipped',
  subject: 'Your order {{ data.order.order_number }} has shipped',
  body_html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">
  <tr>
    <td style="padding:16px;">
      <p>Hi {{ data.order.customer_name }},</p>
      <p>Your order <strong>{{ data.order.order_number }}</strong> has shipped.</p>
      <p><strong>Shipping to:</strong> {{ data.shipping_address.address }}, {{ data.shipping_address.city }}, {{ data.shipping_address.country }}</p>
    </td>
  </tr>
</table>`,
  body_text:
    'Hi {{ data.order.customer_name }},\n' +
    'Your order {{ data.order.order_number }} has shipped.\n' +
    'Shipping to: {{ data.shipping_address.address }}, {{ data.shipping_address.city }}, {{ data.shipping_address.country }}',
};

export const CANCELLED_TEMPLATE: TemplateContent = {
  name: 'Order Cancelled',
  subject: 'Your order {{ data.order.order_number }} has been cancelled',
  body_html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">
  <tr>
    <td style="padding:16px;">
      <p>Hi {{ data.order.customer_name }},</p>
      <p>Your order <strong>{{ data.order.order_number }}</strong> has been cancelled.</p>
      <p>If you have any questions, please contact us.</p>
    </td>
  </tr>
</table>`,
  body_text:
    'Hi {{ data.order.customer_name }},\n' +
    'Your order {{ data.order.order_number }} has been cancelled.\n' +
    'If you have any questions, please contact us.',
};

export const ORDER_TEMPLATES: TemplateContent[] = [
  CONFIRMED_TEMPLATE,
  SHIPPED_TEMPLATE,
  CANCELLED_TEMPLATE,
];
