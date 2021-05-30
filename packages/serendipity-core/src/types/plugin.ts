/*
 * File: plugin.ts
 * Description: 插件声明
 * Created: 2021-1-28 23:56:16
 * Author: yuzhanglong
 * Email: yuzl1123@163.com
 */


// plugin 基本信息
import { BaseObject } from '@attachments/serendipity-public'

export interface PluginModuleInfo {
  // require 的结果
  requireResult: any

  // 该插件的绝对路径
  absolutePath?: string

  // 额外的参数
  options?: BaseObject

  // 名称
  name?: string
}
