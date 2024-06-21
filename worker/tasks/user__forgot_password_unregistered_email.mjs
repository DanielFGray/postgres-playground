const { projectName } = require("../../package.json");

/** @typedef { import("./send_email").SendEmailPayload } SendEmailPayload */
/** @typedef { import("graphile-worker").Task } Task */

/** @typedef {{
  email: string
}} UserForgotPasswordUnregisteredEmailPayload */

/** @type {Task} */
module.exports = async (inPayload, { addJob }) => {
  /** @type {UserForgotPasswordUnregisteredEmailPayload} */
  const payload = inPayload;
  const { email } = payload;

  /** @type {SendEmailPayload} */
  const sendEmailPayload = {
    options: {
      to: email,
      subject: `Password reset request failed: you don't have a ${projectName} account`,
    },
    template: "password_reset_unregistered.mjml",
    variables: {
      url: process.env.ROOT_URL,
    },
  };
  await addJob("send_email", sendEmailPayload);
};
