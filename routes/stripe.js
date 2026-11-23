
import express from "express";
import { getDB } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

const getSubscriptionId = (invoice) => {
  const subscription =
    invoice.parent?.subscription_details?.subscription ||
    invoice.subscription;

  return typeof subscription === "string"
    ? subscription
    : subscription?.id || null;
};

const getSubscriptionDetails = async (stripe, subscriptionId) => {
  if (!subscriptionId) return null;

  return stripe.subscriptions.retrieve(subscriptionId);
};

const fulfillCheckoutSession = async (checkoutSession) => {
  if (
    checkoutSession.mode !== "subscription" ||
    checkoutSession.payment_status !== "paid"
  ) {
    throw new Error(
      "Checkout session is not a successfully paid subscription."
    );
  }

  const email = (
    checkoutSession.metadata?.userEmail ||
    checkoutSession.customer_details?.email ||
    checkoutSession.customer_email ||
    ""
  ).toLowerCase();

  const role = checkoutSession.metadata?.userRole;
  const planName = checkoutSession.metadata?.planName;

  if (!email || !["student", "tutor"].includes(role) || !planName) {
    throw new Error("Required subscription metadata is missing.");
  }

  const db = getDB();
  const users = db.collection("users");
  const payments = db.collection("payments");

  const user = await users.findOne({ email, role });

  if (!user) {
    throw new Error(
      "The account associated with this payment was not found."
    );
  }

  const existingPayment = await payments.findOne({
    stripeSessionId: checkoutSession.id,
  });

  if (!existingPayment) {
    await payments.insertOne({
      userEmail: email,
      userName: user.name || checkoutSession.metadata?.userName || "",
      userRole: role,
      planName,
      amount: (checkoutSession.amount_total || 0) / 100,
      currency: checkoutSession.currency || "usd",
      transactionId:
        checkoutSession.payment_intent ||
        checkoutSession.subscription ||
        checkoutSession.id,
      stripeSessionId: checkoutSession.id,
      paymentStatus: "paid",
      paidAt: new Date(checkoutSession.created * 1000),
    });
  }

  await users.updateOne(
    { email, role },
    { $set: { plan: "pro" } }
  );

  return { email, planName };
};

// Record successful recurring invoices.
// The initial subscription invoice is recorded through Checkout.
const recordRenewalPayment = async (invoice, stripe) => {
  if (invoice.billing_reason !== "subscription_cycle") {
    return;
  }

  const subscriptionId = getSubscriptionId(invoice);

  if (!subscriptionId) {
    throw new Error("Subscription ID is missing from the renewal invoice.");
  }

  const subscription = await getSubscriptionDetails(stripe, subscriptionId);
  const email = subscription?.metadata?.userEmail?.toLowerCase();
  const role = subscription?.metadata?.userRole;
  const planName = subscription?.metadata?.planName;

  if (!email || !["student", "tutor"].includes(role) || !planName) {
    throw new Error("Subscription metadata is missing for this renewal.");
  }

  const db = getDB();
  const users = db.collection("users");
  const payments = db.collection("payments");

  const user = await users.findOne({ email, role });

  if (!user) {
    throw new Error("User account for this renewal was not found.");
  }

  const renewalKey = `invoice_${invoice.id}`;

  const existingPayment = await payments.findOne({
    stripeSessionId: renewalKey,
  });

  if (!existingPayment) {
    await payments.insertOne({
      userEmail: email,
      userName: user.name || subscription.metadata?.userName || "",
      userRole: role,
      planName,
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency || "usd",
      transactionId: invoice.payment_intent || invoice.id,
      stripeSessionId: renewalKey,
      paymentStatus: "paid",
      paidAt: new Date(
        (invoice.status_transitions?.paid_at || invoice.created) * 1000
      ),
    });
  }

  await users.updateOne(
    { email, role },
    { $set: { plan: "pro" } }
  );
};

const handleFailedInvoice = async (invoice, stripe) => {
  const subscriptionId = getSubscriptionId(invoice);

  if (!subscriptionId) return;

  const subscription = await getSubscriptionDetails(stripe, subscriptionId);
  const email = subscription?.metadata?.userEmail?.toLowerCase();
  const role = subscription?.metadata?.userRole;

  if (!email || !["student", "tutor"].includes(role)) return;

  await getDB().collection("users").updateOne(
    { email, role },
    { $set: { plan: "free" } }
  );

  console.log(
    "Subscription payment failed; Pro access revoked for:",
    email
  );
};

const handleDeletedSubscription = async (subscription) => {
  const email = subscription.metadata?.userEmail?.toLowerCase();
  const role = subscription.metadata?.userRole;

  if (!email || !["student", "tutor"].includes(role)) return;

  await getDB().collection("users").updateOne(
    { email, role },
    { $set: { plan: "free" } }
  );

  console.log("Subscription cancelled; account downgraded:", email);
};

export default (auth, stripe) => {
  const router = express.Router();

  // Protected endpoints use JWT authentication.
  router.use(verifyToken);

  // POST /create-checkout-session
  router.post("/create-checkout-session", async (req, res) => {
    try {
      const user = req.user;

      if (!["student", "tutor"].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only students and tutors can subscribe to Pro.",
        });
      }

      if (user.plan === "pro") {
        return res.status(400).json({
          success: false,
          message: "Your account already has the Pro plan.",
        });
      }

      const priceId =
        user.role === "student"
          ? process.env.STRIPE_STUDENT_PRICE_ID
          : process.env.STRIPE_TUTOR_PRICE_ID;

      const planName =
        user.role === "student" ? "Student Pro" : "Tutor Pro";

      if (!priceId) {
        return res.status(500).json({
          success: false,
          message: "The Stripe price for this plan is not configured.",
        });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email,
        client_reference_id: user.id,
        metadata: {
          userEmail: user.email.toLowerCase(),
          userName: user.name || "",
          userRole: user.role,
          planName,
        },
        subscription_data: {
          metadata: {
            userEmail: user.email.toLowerCase(),
            userName: user.name || "",
            userRole: user.role,
            planName,
          },
        },
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      });

      return res.status(200).json({
        success: true,
        url: checkoutSession.url,
      });
    } catch (error) {
      console.error("Stripe Checkout creation error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to create a Stripe Checkout Session.",
      });
    }
  });

  // GET /verify-session
  router.get("/verify-session", async (req, res) => {
    try {
      const user = req.user;

      if (!["student", "tutor"].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only students and tutors can verify subscriptions.",
        });
      }

      const sessionId = req.query.session_id;

      if (
        typeof sessionId !== "string" ||
        !sessionId.startsWith("cs_")
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid Checkout Session ID is required.",
        });
      }

      const checkoutSession =
        await stripe.checkout.sessions.retrieve(sessionId);

      const sessionEmail = (
        checkoutSession.metadata?.userEmail ||
        checkoutSession.customer_details?.email ||
        checkoutSession.customer_email ||
        ""
      ).toLowerCase();

      if (sessionEmail !== user.email.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "This payment does not belong to your account.",
        });
      }

      if (
        checkoutSession.mode !== "subscription" ||
        checkoutSession.payment_status !== "paid"
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment has not been completed yet.",
        });
      }

      const result = await fulfillCheckoutSession(checkoutSession);

      return res.status(200).json({
        success: true,
        message: "Your Pro subscription has been activated.",
        data: result,
      });
    } catch (error) {
      console.error("Stripe session verification error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify your payment.",
      });
    }
  });

  return router;
};

// Stripe webhook handler: deliberately does not use JWT authentication.
export const createStripeWebhookHandler = (stripe) => {
  return async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(500).send("Webhook secret is not configured.");
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (error) {
      console.error(
        "Stripe webhook signature verification failed:",
        error.message
      );

      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await fulfillCheckoutSession(event.data.object);
          console.log("Initial subscription payment processed.");
          break;

        case "invoice.paid":
          await recordRenewalPayment(event.data.object, stripe);
          break;

        case "invoice.payment_failed":
          await handleFailedInvoice(event.data.object, stripe);
          break;

        case "customer.subscription.deleted":
          await handleDeletedSubscription(event.data.object);
          break;

        default:
          console.log("Unhandled Stripe event:", event.type);
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stripe webhook processing error:", error);

      return res.status(500).json({
        success: false,
        message: "Webhook processing failed.",
      });
    }
  };
};
