/*
 * File: SerendipityEslintPlugin.ts
 * Description: eslint 插件
 * Created: 2021-2-26 14:18:03
 * Author: yuzhanglong
 * Email: yuzl1123@163.com
 */

import { serendipityEnv } from '@attachments/serendipity-public'
import { Construction, ConstructionOptions, Inquiry, Runtime, RuntimeOptions } from '@attachments/serendipity-core'
import SerendipityReactPlugin from '@attachments/serendipity-plugin-react'
import { appRoot, appSource } from '@attachments/serendipity-public/lib/utils/paths'
import { EslintInquiryOptions } from './types'
import { ESLINT_OPTION_TO_CONFIG } from './common'

const ESLintWebpackPlugin = require('eslint-webpack-plugin')

export class EslintPlugin {
  /**
   * 基于 SerendipityReactPlugin 的 runtime 配置
   * 可以在 devServer 控制台展示 eslint 信息
   *
   * @author yuzhanglong
   * @date 2021-2-26 15:00:02
   */
  @Runtime()
  startReactRuntime(options: RuntimeOptions) {
    const plugin = options.matchPlugin('serendipity-react-plugin')
    const instance: SerendipityReactPlugin = plugin.getPluginInstance() as SerendipityReactPlugin
    if (plugin) {
      instance.reactServiceHooks.beforeWebpackStart.tap('webpackMerge', (mergeFn) => {
        mergeFn({
          plugins: [
            // 开发环境时注入 plugin
            serendipityEnv.isProjectDevelopment() && new ESLintWebpackPlugin({
              // lint 主目录
              context: appSource,

              // 欲 lint 的文件扩展名
              extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],

              // eslint 路径
              eslintPath: require.resolve('eslint'),

              // 主目录
              cwd: appRoot
            })
          ].filter(Boolean)
        })
      })
    }
  }

  /**
   * eslint 基础配置
   *
   * @author yuzhanglong
   * @date 2021-2-26 14:48:06
   */
  @Construction()
  async constructionForBase(options: ConstructionOptions) {
    const inquiryOpts = options.inquiryResult as EslintInquiryOptions
    const packageManager = options.appManager.packageManager

    // 合并用户选择的 eslint 配置
    inquiryOpts.extendConfig.forEach(conf => {
      const target = ESLINT_OPTION_TO_CONFIG[conf]
      if (conf) {
        packageManager.mergeIntoCurrent({
          eslintConfig: {
            rules: {
              ...target.defaultRules
            }
          }
        })
      }

      const pkg = ESLINT_OPTION_TO_CONFIG[conf].package
      if (pkg) {
        packageManager.mergeIntoCurrent({
          devDependencies: {
            [pkg]: ESLINT_OPTION_TO_CONFIG[conf].version
          }
        })
      }

      packageManager.mergeIntoCurrent({
        eslintConfig: {
          extends: [...target.extendName]
        }
      })
    })

    options.appManager.packageManager.mergeIntoCurrent({
      // 依赖
      devDependencies: {
        // 基本的 eslint 依赖
        'eslint': '^7.19.0',

        // 是否需要 typescript

        ...inquiryOpts.useTypeScript && {
          '@typescript-eslint/eslint-plugin': '^4.15.0',
          '@typescript-eslint/parser': '^4.15.0'
        }
      },

      // 提供 npm run lint script 启动 eslint 检查
      scripts: {
        'lint': `eslint ${inquiryOpts.useTypeScript ? '--ext .ts --ext .tsx' : '--ext .js --ext .jsx'} --max-warnings 0 ./src`
      },

      // eslint 基础配置
      eslintConfig: {
        root: true,

        parserOptions: {
          ecmaVersion: 2018,
          sourceType: 'module'
        },

        env: {
          browser: true,
          node: true
        },

        plugins: inquiryOpts.useTypeScript ? ['@typescript-eslint'] : [],

        rules: inquiryOpts.useTypeScript && {
          '@typescript-eslint/no-empty-interface': 'warn',
          '@typescript-eslint/no-var-requires': 'off',
          '@typescript-eslint/ban-ts-comment': 'off',
          '@typescript-eslint/explicit-module-boundary-types': 'off',
          '@typescript-eslint/no-explicit-any': 'off',
          '@typescript-eslint/no-empty-function': 'off'
        },

        ...inquiryOpts.useTypeScript && {
          'parser': '@typescript-eslint/parser'
        }
      }
    })
  }

  /**
   * 基于 react 的 eslint 配置
   *
   * @author yuzhanglong
   * @date 2021-2-26 14:48:06
   */
  @Construction()
  constructionForReact(options: ConstructionOptions) {
    const inquiryOpts = options.inquiryResult as EslintInquiryOptions
    if (inquiryOpts.environment === 'React') {

      // react eslint 相关依赖
      const packageManager = options.appManager.packageManager
      packageManager.mergeIntoCurrent({
        dependencies: {
          'babel-eslint': '^10.1.0',
          'eslint': '^7.19.0',
          // eslint-config-react-app 并不兼容新的 @babel/eslint-parser
          'eslint-config-react-app': '^6.0.0',
          'eslint-plugin-flowtype': '^5.2.0',
          'eslint-plugin-import': '^2.22.0',
          'eslint-plugin-jest': '^24.0.0',
          'eslint-plugin-jsx-a11y': '^6.3.1',
          'eslint-plugin-react': '^7.22.0',
          'eslint-plugin-react-hooks': '^4.0.8',
          'eslint-plugin-testing-library': '^3.9.0'
        }
      })

      // 将配置文件写入 package.json 中
      packageManager.mergeIntoCurrent({
        // eslint 配置
        eslintConfig: {
          extends: [
            'react-app'
          ]
        }
      })
    }
  }

  @Inquiry()
  baseInquiry() {
    return [
      {
        type: 'list',
        message: '请选择你的开发环境',
        name: 'environment',
        choices: [
          'React',
          '其他项目'
        ],
        default: '其他项目'
      },
      {
        type: 'confirm',
        message: '是否添加 typescript 解析支持',
        name: 'useTypeScript',
        default: false
      },
      {
        type: 'checkbox',
        message: '选择一个或者多个 eslint 规范',
        name: 'extendConfig',
        choices: [
          {
            message: 'eslint:recommended(eslint default)',
            name: 'recommend'
          },
          {
            message: 'Airbnb',
            name: 'Airbnb'
          },
          {
            message: 'plugin import(import statement lint)',
            name: 'import'
          }
        ],
        default: ['recommend']
      }
    ]
  }
}
