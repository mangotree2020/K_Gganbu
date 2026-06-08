const { withDangerousMod } = require('@expo/config-plugins')
const { resolve } = require('path')
const { readFileSync, writeFileSync } = require('fs')

module.exports = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = resolve(cfg.modRequest.platformProjectRoot, 'Podfile')
      let podfile = readFileSync(podfilePath, 'utf8')

      // use_modular_headers! 제거 (Firebase Swift 헤더와 충돌)
      podfile = podfile.replace(/^use_modular_headers!\n?/m, '')

      // use_frameworks! :linkage => :static 삽입 (Firebase Swift 헤더 생성에 필요)
      if (!podfile.includes('use_frameworks! :linkage => :static')) {
        podfile = podfile.replace(
          /^(platform :ios,.+)$/m,
          '$1\nuse_frameworks! :linkage => :static',
        )
      }

      writeFileSync(podfilePath, podfile)
      return cfg
    },
  ])
