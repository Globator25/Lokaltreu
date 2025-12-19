const RULE_NAME = "no-manual-api-types";
const MESSAGE_ID = "noManualApiTypes";
const ERROR_MESSAGE =
  "Keine manuellen API-Typen im Frontend; nutze @lokaltreu/types (OpenAPI-Codegen).";

const forbiddenSuffixes = ["Request", "Response", "Dto"];

const hasForbiddenSuffix = (name) =>
  forbiddenSuffixes.some((suffix) => name.endsWith(suffix));

const hasForbiddenPrefix = (name) => name.startsWith("Api");

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Verbietet handgeschriebene API-Typdefinitionen im Frontend.",
      recommended: true,
    },
    messages: {
      [MESSAGE_ID]: ERROR_MESSAGE,
    },
    schema: [],
  },
  create(context) {
    const reportIfForbiddenName = (node, name) => {
      if (!name) {
        return;
      }

      if (hasForbiddenSuffix(name) || hasForbiddenPrefix(name)) {
        context.report({
          node,
          messageId: MESSAGE_ID,
        });
      }
    };

    return {
      TSTypeAliasDeclaration(node) {
        reportIfForbiddenName(node.id, node.id?.name);
      },
      TSInterfaceDeclaration(node) {
        reportIfForbiddenName(node.id, node.id?.name);
      },
    };
  },
};
