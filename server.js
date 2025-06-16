require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow requests from any origin
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.post('/create-checkout-session', async (req, res) => {
  const { serviceType, amount, currency } = req.body;

  try {
    // Create a product name based on service type
    let productName;
    switch (serviceType) {
      case 'text_chat':
        productName = 'Text Chat Consultation';
        break;
      case 'video_call':
        productName = 'Video & Audio Consultation';
        break;
      case 'case_study':
        productName = 'Case Study & Analysis';
        break;
      default:
        productName = 'Legal Service';
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency || 'sar',
          product_data: {
            name: productName,
            description: `Khbrah Law Firm - ${productName}`,
          },
          unit_amount: amount * 100, // Stripe uses cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.body.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: req.body.cancelUrl,
      metadata: {
        serviceType: serviceType,
        amount: amount,
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for handling successful payments
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET // Use environment variable for webhook secret
    );
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Here you can:
    // 1. Update your database
    // 2. Send confirmation emails
    // 3. Create service access for the user
    // 4. etc.
    
    console.log('Payment successful:', session);
  }

  res.json({ received: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 