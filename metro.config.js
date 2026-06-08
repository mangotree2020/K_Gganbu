const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.resolver.extraNodeModules = {
  '@react-native-firebase/app': path.resolve(__dirname, 'node_modules/@react-native-firebase/app'),
  '@react-native-firebase/auth': path.resolve(__dirname, 'node_modules/@react-native-firebase/auth'),
}

module.exports = config
