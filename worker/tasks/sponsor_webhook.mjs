/** @typedef { import("./send_email").SendEmailPayload } SendEmailPayload */
/** @typedef { import("graphile-worker").Task } Task */

/** @type {Task} */
export default async (inPayload, { addJob }) => {
  // FIXME: parse webhook payload
  const payload = inPayload;
  if (payload.status === "active") {
    const tier = payload.tier;
    await addJob("enable_sponsorship", { tier });
  }
  if (payload.status === "cancelled") {
    // TODO: findLastPaymentDate()
    // await addJob("disable_sponsorship", {}, { runAt: last_payment + (DAYS * 30) })
  }
};
