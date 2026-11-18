import { connection } from "next/server";
import { todaysRates } from "@/rates/todays-rates";

/**
 * Today's exchange rates for the Expense form (and for Guests, whose
 * Expenses are recorded in the browser). Only rates go out; the currency
 * API key stays on the server.
 */
export async function GET() {
  await connection();
  return Response.json(await todaysRates(), {
    headers: { "Cache-Control": "private, max-age=600" },
  });
}
