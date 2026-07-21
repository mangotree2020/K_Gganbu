// 원격 이미지 캐시 컴포넌트 — expo-image 래퍼(메모리+디스크 캐시·빠른 네이티브 디코드).
// RN 기본 Image는 원격 URI를 마운트마다 재다운로드·재디코드해 앱 실행 시 이미지 로딩이 느림.
// resizeMode 명명을 유지해 기존 <Image> 교체 비용을 최소화한다.
import { Image, type ImageProps, type ImageContentFit } from 'expo-image'

const FIT: Record<string, ImageContentFit> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
}

export type CachedImageProps = Omit<ImageProps, 'contentFit'> & {
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'
  contentFit?: ImageContentFit
}

export function CachedImage({ resizeMode, contentFit, ...props }: CachedImageProps) {
  return (
    <Image
      cachePolicy="memory-disk"
      transition={120}
      contentFit={contentFit ?? (resizeMode ? FIT[resizeMode] : 'cover')}
      {...props}
    />
  )
}
