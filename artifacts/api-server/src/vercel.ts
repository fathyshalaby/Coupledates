// Vercel entry: export the Express app as the request handler instead of listening on a port.
// Billing webhook setup is not run at startup here; checkout retries it before allowing a purchase.
export { default } from "./app";
