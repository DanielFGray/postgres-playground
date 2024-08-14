/* eslint-disable @typescript-eslint/no-var-requires */
const { template: lodashTemplate } = require("lodash");
const mjml2html = require("mjml");
const chalk = require("chalk");
const fs = require("fs/promises");
const { htmlToText } = require("html-to-text");
const nodemailer = require("nodemailer");
const getTransport = require("../transport");
const { projectName, fromEmail, legalText } = require("../../package.json");

global.TEST_EMAILS = [];

const { readFile } = fs;

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV !== "production";

/** @typedef {{
  options: {
    from?: string;
    to: string | string[];
    subject: string;
  };
  template: string;
  variables: {
    [varName: string]: any;
  };
}} SendEmailPayload */

/** @typedef {import("graphile-worker").Task} Task */
/** @type {Task} */
module.exports = async inPayload => {
  /** @type {SendEmailPayload} */
  const payload = inPayload;
  const transport = await getTransport();
  const { options: inOptions, template, variables } = payload;
  const options = {
    from: fromEmail,
    ...inOptions,
  };
  if (template) {
    const templateFn = await loadTemplate(template);
    const html = await templateFn(variables);
    const html2textableHtml = html.replace(/(<\/?)div/g, "$1p");
    const text = htmlToText(html2textableHtml, {
      wordwrap: 120,
    }).replace(/\n\s+\n/g, "\n\n");
    Object.assign(options, { html, text });
  }
  const info = await transport.sendMail(options);
  if (isTest) {
    global.TEST_EMAILS.push(info);
  } else if (isDev) {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) {
      console.log(`Development email preview: ${chalk.blue.underline(url)}`);
    }
  }
};

const templatePromises = {};
function loadTemplate(template) {
  if (isDev || !templatePromises[template]) {
    templatePromises[template] = (async () => {
      if (!template.match(/^[a-zA-Z0-9_.-]+$/)) {
        throw new Error(`Disallowed template name '${template}'`);
      }
      const templateString = await readFile(
        `${__dirname}/../templates/${template}`,
        "utf8",
      );
      const templateFn = lodashTemplate(templateString, {
        escape: /\[\[([\s\S]+?)\]\]/g,
      });
      return variables => {
        const mjml = templateFn({
          projectName,
          legalText,
          ...variables,
        });
        const { html, errors } = mjml2html(mjml);
        if (errors && errors.length) {
          console.error(errors);
        }
        return html;
      };
    })();
  }
  return templatePromises[template];
}
