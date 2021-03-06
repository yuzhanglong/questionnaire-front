const path = require('path')

module.exports = {
  initialDir: false,
  plugins: [
    {
      name: '@attachments/serendipity-plugin-typescript',
      path: path.resolve(__dirname, '../../../packages/serendipity-plugin-typescript'),
      removeAfterConstruction: true
    },
    {
      name: '@attachments/serendipity-plugin-eslint',
      path: path.resolve(__dirname, '../../../packages/serendipity-plugin-eslint'),
      overrideInquiries: {
        environment: '其他项目',
        useTypeScript: true
      },
      removeAfterConstruction: true
    }
  ]
}
