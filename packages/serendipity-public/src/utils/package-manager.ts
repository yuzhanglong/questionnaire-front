/*
 * File: packageManager.ts
 * Description: 包管理模块
 * Created: 2021-5-28 00:36:26
 * Author: yuzhanglong
 * Email: yuzl1123@163.com
 */

import * as path from 'path'
import * as fs from 'fs'
import { sortPackageJson } from 'sort-package-json'
import { PACKAGE_JSON_BASE, runCommand, webpackMerge, writeFilePromise } from '../index'
import {
  BaseObject,
  MergePackageConfigOptions,
  ModuleInstallOptions,
  PackageManagerName,
  PackageManagerOptions
} from '../types'
import { resolveModule } from './resolve-module'
import { mergeDependencies } from './merge-deps'

export class PackageManager {
  // 包管理路径
  private readonly basePath: string

  // 管理工具名称
  private readonly managerName: PackageManagerName

  // package.json 配置
  private packageConfig: BaseObject


  constructor(options: PackageManagerOptions) {
    const { basePath, managerName, packageConfig } = options
    this.basePath = basePath
    this.managerName = managerName || PackageManager.getPackageManagerName(basePath)
    this.packageConfig = packageConfig || PACKAGE_JSON_BASE
  }

  /**
   * 工厂函数，基于某个已经存在的工作目录初始化 manager
   *
   * @author yuzhanglong
   * @param basePath 基础路径
   * @date 2021-2-12 23:20:11
   */
  public static createWithResolve(basePath: string): PackageManager {
    // 包管理工具名称
    const managerName = PackageManager.getPackageManagerName(basePath)

    const manager = new PackageManager({
      basePath: basePath,
      managerName: managerName
    })

    manager.resolvePackageConfig()
    return manager
  }

  /**
   * 工厂函数，基于 PackageManagerOptions 初始化 manager
   *
   * @author yuzhanglong
   * @param options manager 选项
   * @date 2021-5-28 09:03:11
   */
  public static createWithOptions(options: PackageManagerOptions): PackageManager {
    return new PackageManager(options)
  }

  /**
   * 根据传入的 basePath，读取文件，拿到配置对象
   *
   * @author yuzhanglong
   * @return boolean 是否读取成功
   * @date 2021-2-12 23:20:11
   */
  private resolvePackageConfig() {
    const packageConfigPath = path.resolve(this.basePath, 'package.json')
    // 尝试 require
    try {
      this.packageConfig = resolveModule(packageConfigPath)
      return true
    } catch (e) {
      throw new Error('package.json 文件不存在！')
    }
  }

  /**
   * 执行配置合并
   *
   * @author yuzhanglong
   * @param data 合并内容
   * @param options 合并配置
   * @date 2021-2-12 23:13:19
   */
  public mergeIntoCurrent(data: BaseObject, options?: MergePackageConfigOptions): void {
    const resultOptions: MergePackageConfigOptions = {
      merge: true,
      ignoreNullOrUndefined: true
    }

    Object.assign(resultOptions, options)

    const dataToMerge = data

    for (const key of Object.keys(dataToMerge)) {
      // 新配置
      const val = dataToMerge[key]

      // 旧配置
      const oldValue = this.packageConfig[key]

      const isDependenciesKey = (key === 'dependencies' || key === 'devDependencies')

      // 选择 忽略 null / undefined 值
      if (resultOptions.ignoreNullOrUndefined && !val) {
        continue
      }

      // 如果不使用 merge 或者之前没有已存在的配置，直接写入即可
      if (!resultOptions.merge || !oldValue) {
        this.packageConfig[key] = val
        continue
      }

      // 是依赖包相关字段
      if (typeof val === 'object' && isDependenciesKey) {
        this.packageConfig[key] = mergeDependencies(
          (oldValue as BaseObject),
          (val as BaseObject)
        )
        continue
      }

      // 普通字段合并
      if (typeof val === 'object' && typeof oldValue === 'object') {
        this.packageConfig[key] = webpackMerge(oldValue, val)
      }
    }
  }

  /**
   * 将新的配置写入磁盘中
   *
   * @author yuzhanglong
   * @return boolean 是否读取成功
   * @date 2021-2-12 23:18:47
   */
  public async writePackageConfig(): Promise<void> {
    await writeFilePromise(
      path.resolve(this.basePath, 'package.json'),
      // 默认 2 缩进
      JSON.stringify(this.getPackageConfig(), null, 2)
    )
  }

  /**
   * 安装依赖
   *
   * @author yuzhanglong
   * @return boolean 是否读取成功
   * @date 2021-2-12 23:24:40
   */
  public async installDependencies(): Promise<void> {
    await runCommand(
      `${this.managerName}`,
      ['install'],
      this.basePath)
  }

  /**
   * 获取 package.json 配置
   * 注意：这里获得的配置会进行一次必要的排序，主要是为了输出的美观，所以尽量使用此方法获取配置
   *
   * @author yuzhanglong
   * @date 2021-2-2 22:06:32
   */
  public getPackageConfig(): BaseObject {
    const tmp = this.packageConfig
    for (const tmpKey in tmp) {
      if (Object.prototype.hasOwnProperty.call(tmp, tmpKey)) {
        // 如果某个字段的值是 {} 我们删除之, 至于为什么不处理 null 和 undefined，
        // 实践证明有些 bug 会以这种方式体现，方便 debug
        const val = tmp[tmpKey]
        if (val !== null && typeof val === 'object' && Object.keys(val).length === 0) {
          delete tmp[tmpKey]
        }
      }
    }
    return sortPackageJson(tmp)
  }


  /**
   * 安装某个依赖, 可参考 https://yarn.bootcss.com/docs/cli/add/
   *
   * @author yuzhanglong
   * @param installOptions install 选项
   * @see ModuleInstallOptions
   * @return boolean 是否读取成功
   * @date 2021-2-12 23:47:51
   */
  public async addAndInstallModule(installOptions: ModuleInstallOptions): Promise<BaseObject> {
    if (installOptions) {
      try {
        const { command, args } = this.getInstallCommand(installOptions)
        // 执行安装命令
        await runCommand(command, args, this.basePath)
        return resolveModule(path.resolve(this.basePath, 'node_modules', installOptions.name))
      } catch (e) {
        if (installOptions.onError && typeof installOptions.onError === 'function') {
          installOptions?.onError(e)
        } else {
          throw new Error(e)
        }
      }
    }
    return {}
  }


  /**
   * 根据参数获取安装命令字符串
   *
   * @author yuzhanglong
   * @param installOptions install 选项
   * @return 结果字符串
   * @date 2021-2-17 17:47:04
   */
  private getInstallCommand(installOptions: ModuleInstallOptions): { args: any[]; command: string } {
    const command = `${this.managerName} ${this.managerName === 'yarn' ? 'add' : 'install'}`
    const args = []
    // 如果传入了本地路径，我们从本地路径安装
    // yarn add file:/path/to/local/folder
    if (installOptions.localPath) {
      args.push(`file:${installOptions.localPath}`)
    } else {
      // 如果有版本号，需要加上 @版本号 ，例如 yarn add foo@1.0.0
      const v = `${installOptions.name}` + (installOptions.version ? `@${installOptions.version}` : '')
      args.push(v)
    }
    return {
      command: command,
      args: args
    }
  }


  /**
   * PackageConfig setter
   *
   * @author yuzhanglong
   * @param packageConfig package.json
   * @return boolean 是否读取成功
   * @date 2021-2-13 09:02:33
   */
  public setPackageConfig(packageConfig: BaseObject): void {
    this.packageConfig = packageConfig
  }

  /**
   * 获取某个模块
   *
   * @author yuzhanglong
   * @param name 模块名称
   * @return boolean 是否读取成功
   * @date 2021-2-13 09:02:50
   */
  public getPackageModule(name: string): BaseObject {
    return require(
      path.resolve(this.basePath, 'node_modules', name)
    )
  }

  /**
   * 判断选择哪个包管理工具
   * 如果工作目录下存在 yarn.lock 则为 yarn, 否则为 npm
   *
   * @author yuzhanglong
   * @return PackageManagerName package cli 类型
   * @date 2021-2-26 21:45:13
   */
  private static getPackageManagerName(basePath: string): PackageManagerName {
    const isYarnLockJsonExist = fs.existsSync(path.resolve(basePath, 'yarn.lock'))
    return isYarnLockJsonExist ? 'yarn' : 'npm'
  }

  /**
   * 调用 npm/yarn remove 移除某个依赖
   *
   * @author yuzhanglong
   * @param name 移除依赖的名称
   * @date 2021-2-26 21:50:51
   */
  public async removeDependency(name: string) {
    await runCommand(`${this.managerName}`, ['remove', name], this.basePath)
  }
}
