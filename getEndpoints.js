import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

function parseTemplate(functionBody, name) {
    const templates = [];
    if (!functionBody) {
        console.log('Got no function body??');
        return '';
    }
    walk.simple(functionBody, {
        TemplateLiteral(node) {
            templates.push(node);
        },
    });
    if (templates.length > 1)
        console.log(
            name,
            'Found property with more then 1 template literals in string, it might cause issues',
        );

    const template = templates.splice(-1)[0];
    let path = '';
    for (let i = 0; i < template.quasis.length; i++) {
        path += template.quasis[i].value.raw;

        if (i < template.expressions.length) {
            // skip repeating stuff on same place
            if (!path.endsWith('/:param') && !path.endsWith('=:param'))
                path +=
                    path.endsWith('/') || path.endsWith('=')
                        ? ':param'
                        : '/:param';
        }
    }

    return path;
}

export default function getEndpoints(file) {
    const endpoints = {};

    const ast = acorn.parse(file, { ecmaVersion: 'latest' });
    walk.simple(
        ast,
        {
            ObjectExpression(node, state) {
                if (
                    state.step === 0 &&
                    node.properties.find(
                        (x) => x.key?.name === 'USER_RELATIONSHIP',
                    )
                ) {
                    state.step = 1;

                    for (const property of node.properties) {
                        const key = property.key.name;
                        let path;

                        if (property.value.type === 'Literal') {
                            path = property.value.value;
                        }

                        if (
                            !path &&
                            ![
                                'FunctionExpression',
                                'ArrowFunctionExpression',
                            ].includes(property.value.type)
                        )
                            throw new Error(
                                `Unexpected node type: ${property.value.type}`,
                            );

                        if (
                            property.value.type === 'ArrowFunctionExpression' &&
                            property.value.body.type === 'Literal'
                        )
                            path = property.value.body.value;
                        if (!path)
                            path = parseTemplate(
                                property.value.body,
                                property.key.name,
                            );

                        endpoints[key] = path;
                    }
                }
            },
        },
        undefined,
        { step: 0 },
    );

    return endpoints;
}
