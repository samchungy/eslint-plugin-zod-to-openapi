import { ESLintUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { createComment, getComment } from '../util/comments';
import { findOpenApiCallExpression } from '../util/traverse';
import { getType } from '../util/type';

interface Description {
  property: TSESTree.Property;
  value: TSESTree.Literal['value'];
}

const getDescription = (
  properties: TSESTree.ObjectLiteralElement[],
): Description | undefined => {
  for (const property of properties) {
    if (
      property.type === 'Property' &&
      property.key.type === 'Identifier' &&
      property.key.name === 'description' &&
      property.value.type === 'Literal'
    ) {
      return {
        property,
        value: property.value.value,
      };
    }
  }
  return undefined;
};

const testDescription = (
  node: TSESTree.VariableDeclaration | TSESTree.Property,
  context: Readonly<TSESLint.RuleContext<any, any>>,
  openApiCallExpression: TSESTree.CallExpression,
) => {
  const argument = openApiCallExpression?.arguments[0];
  if (!argument || argument.type !== 'ObjectExpression') {
    return;
  }

  const description = getDescription(argument.properties);

  if (!description) {
    return context.report({
      messageId: 'required',
      node: openApiCallExpression,
    });
  }

  const descriptionValue = description.value;

  if (typeof descriptionValue !== 'string') {
    return;
  }

  if (!descriptionValue.length) {
    return context.report({
      messageId: 'required',
      node: description.property,
    });
  }

  const commentNode = node.type === 'VariableDeclaration' ? node.parent : node;
  if (!commentNode) {
    return;
  }

  const comment = getComment(commentNode, context);

  if (!comment) {
    return context.report({
      messageId: 'comment',
      node: commentNode,
      fix: (fixer) =>
        fixer.insertTextBefore(
          commentNode,
          createComment(descriptionValue, commentNode.loc),
        ),
    });
  }

  if (!comment.value.includes(descriptionValue)) {
    return context.report({
      messageId: 'comment',
      node: comment,
      fix: (fixer) => [
        fixer.removeRange([
          comment.range[0] - (commentNode.loc.start.column + 1),
          comment.range[1],
        ]),
        fixer.insertTextBefore(
          commentNode,
          createComment(descriptionValue, commentNode.loc),
        ),
      ],
    });
  }
};

// eslint-disable-next-line new-cap
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`,
);

export const rule = createRule({
  create(context) {
    return {
      VariableDeclaration(node) {
        const declarator = node?.declarations[0];
        if (!declarator) {
          return;
        }

        if (declarator.init?.type === 'Identifier') {
          return;
        }

        const type = getType(declarator, context);

        if (!type?.isZodType) {
          return;
        }

        const openApiCallExpression = findOpenApiCallExpression(declarator);

        if (!openApiCallExpression) {
          return;
        }

        return testDescription(node, context, openApiCallExpression);
      },
      Property(node) {
        const type = getType(node, context);
        if (!type?.isZodType) {
          return;
        }

        const openApiCallExpression = findOpenApiCallExpression(node);

        if (!openApiCallExpression) {
          return;
        }

        return testDescription(node, context, openApiCallExpression);
      },
    };
  },
  name: 'open-api-description',
  meta: {
    fixable: 'code',
    type: 'problem',
    messages: {
      required: '.openapi() description is required on Zod Schema',
      comment: '.openapi() description must match comment',
    },
    schema: [],
    docs: {
      description:
        'Requires that all zod schema have a description and matching comment',
      recommended: 'error',
    },
  },
  defaultOptions: [],
});
