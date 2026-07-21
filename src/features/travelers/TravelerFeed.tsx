// 여행자 후기 인스타 스타일 피드 — 프로필 + 리뷰글 + 미디어(다중 이미지·영상) + 장소 링크 + 별/댓글/공유.
// 정렬(시간+거리)과 무한 스크롤 로딩은 상위(홈)에서 posts/loadingMore로 주입한다.
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'

import { Icon } from '@/components/brand'
import { CachedImage } from '@/components/CachedImage'
import { PlaceThumb } from '@/components/PlaceThumb'
import { ProfileAvatar as MyProfileAvatar } from '@/features/profile/Avatar'
import { ageLabel, type MediaItem, type TravelerPost } from './feed'
import { useFeedStore, type MyComment } from './store'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

// 미디어(이미지/영상) 표시 높이
const MEDIA_H = 240

// 장소 상세로 이동 — 후기의 장소 좌표/정보를 place 화면 파라미터로 전달
function goToPlace(post: TravelerPost) {
  router.push({
    pathname: '/place',
    params: {
      name: post.place,
      cat: post.cat,
      extId: post.id,
      img: post.media.find((m) => m.type === 'image')?.uri ?? '',
      lat: post.lat != null ? String(post.lat) : '',
      lng: post.lng != null ? String(post.lng) : '',
      sub: '',
      rating: '',
      badge: '',
    },
  })
}

// 작성자 이름 → 안정적인 프로필 색(아바타 배경)
const AVATAR_COLORS = [
  palette.blue[50],
  palette.coral[50],
  palette.teal[40],
  palette.amber[50],
  palette.violet[40],
  palette.indigo[40],
  palette.success[50],
  palette.rose[40],
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// 여행자 프로필 아바타 — 이니셜 원 + 국기 배지
function ProfileAvatar({ name, flag }: { name: string; flag: string }) {
  return (
    <View style={[ss.avatar, { backgroundColor: avatarColor(name) }]}>
      <Text style={ss.avatarText}>{name[0]}</Text>
      <View style={ss.flagBadge}>
        <Text style={ss.flagText}>{flag}</Text>
      </View>
    </View>
  )
}

// 영상 페이지 — 활성(현재 보이는) 페이지일 때만 음소거·반복 재생(오프스크린은 정지)
function VideoPage({ item, width, active }: { item: MediaItem; width: number; active: boolean }) {
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = true
    p.muted = true
  })
  useEffect(() => {
    if (active) player.play()
    else player.pause()
  }, [active, player])
  return (
    <View style={{ width, height: MEDIA_H, backgroundColor: '#000' }}>
      <VideoView
        player={player}
        style={{ width, height: MEDIA_H }}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={ss.videoBadge}>
        <Text style={ss.videoBadgeText}>▶</Text>
      </View>
    </View>
  )
}

// 미디어 캐러셀 — 이미지 여러 장 + 영상 가로 페이징 + 하단 인디케이터 도트
function MediaCarousel({ media, cat }: { media: MediaItem[]; cat: string }) {
  const [w, setW] = useState(0)
  const [idx, setIdx] = useState(0)
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w > 0) setIdx(Math.round(e.nativeEvent.contentOffset.x / w))
  }
  if (media.length === 0) {
    return (
      <View style={ss.imageWrap}>
        <PlaceThumb category={cat} height={MEDIA_H} />
      </View>
    )
  }
  return (
    <View style={ss.imageWrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEnabled={media.length > 1}>
        {w > 0 &&
          media.map((m, i) =>
            m.type === 'video' ? (
              <VideoPage key={`${m.uri}:${i}`} item={m} width={w} active={i === idx} />
            ) : (
              <CachedImage
                key={`${m.uri}:${i}`}
                source={{ uri: m.uri }}
                style={{ width: w, height: MEDIA_H }}
                resizeMode="cover"
              />
            ),
          )}
      </ScrollView>
      {/* 장수 카운터(우상단) */}
      {media.length > 1 && (
        <View style={ss.mediaCount}>
          <Text style={ss.mediaCountText}>
            {idx + 1}/{media.length}
          </Text>
        </View>
      )}
      {/* 하단 도트 인디케이터 */}
      {media.length > 1 && (
        <View style={ss.dots}>
          {media.map((_, i) => (
            <View key={i} style={[ss.dot, i === idx && ss.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

function PostCard({
  post,
  onOpenComments,
}: {
  post: TravelerPost
  onOpenComments: (id: string) => void
}) {
  const t = useT()
  const liked = useFeedStore((s) => !!s.liked[post.id])
  const myComments = useFeedStore((s) => s.comments[post.id])
  const toggleLike = useFeedStore((s) => s.toggleLike)

  const likeCount = post.likes + (liked ? 1 : 0)
  const myCommentCount =
    (myComments?.length ?? 0) + (myComments?.reduce((n, c) => n + (c.replies?.length ?? 0), 0) ?? 0)
  const commentCount = post.seedComments + myCommentCount
  const commented = myCommentCount > 0 // 내가 이 후기에 댓글/답글을 남겼는지

  const onShare = () => {
    Share.share({
      message: `${post.author} on K-Gganbu: “${post.text}” — ${post.place}`,
    }).catch(() => {})
  }

  return (
    <View style={[ss.card, shadows.card]}>
      {/* 프로필 헤더 */}
      <View style={ss.head}>
        <ProfileAvatar name={post.author} flag={post.flag} />
        <View style={{ flex: 1 }}>
          <Text style={ss.name} numberOfLines={1}>
            {post.author} <Text style={ss.flagInline}>{post.flag}</Text>
          </Text>
          <Text style={ss.meta} numberOfLines={1}>
            {post.place} · {ageLabel(post.ageMin, t('travelers.justNow'))}
            {post.dist !== Infinity ? ` · ${post.dist.toFixed(1)}km` : ''}
          </Text>
        </View>
      </View>

      {/* 리뷰글 */}
      <Text style={ss.caption}>{post.text}</Text>

      {/* 미디어 영역 — 이미지 여러 장 + 영상 캐러셀 */}
      <MediaCarousel media={post.media} cat={post.cat} />

      {/* 장소 바로가기 — 좌표 있으면 이미지 하단에 링크 표시 → 장소 상세로 이동 */}
      {post.lat != null && post.lng != null && (
        <Pressable style={ss.placeLink} onPress={() => goToPlace(post)} hitSlop={4}>
          <Icon name="location_on" size={14} color={palette.blue[50]} filled />
          <Text style={ss.placeLinkText} numberOfLines={1}>
            {post.place}
          </Text>
          <Icon name="open_in_new" size={13} color={palette.blue[50]} />
        </Pressable>
      )}

      {/* 액션: 별(좋아요) / 댓글 / 공유 */}
      <View style={ss.actions}>
        <Pressable style={ss.actionBtn} onPress={() => toggleLike(post.id)} hitSlop={6}>
          <Icon
            name="star"
            size={22}
            color={liked ? palette.amber[50] : palette.zinc[500]}
            filled={liked}
          />
          <Text style={[ss.actionCount, liked && { color: palette.amber[50] }]}>{likeCount}</Text>
        </Pressable>
        <Pressable style={ss.actionBtn} onPress={() => onOpenComments(post.id)} hitSlop={6}>
          {/* 내가 댓글 단 후기는 아이콘·숫자를 파랑으로 채워 구분 */}
          <Icon
            name="sms"
            size={20}
            color={commented ? palette.blue[50] : palette.zinc[500]}
            filled={commented}
          />
          <Text style={[ss.actionCount, commented && { color: palette.blue[50] }]}>
            {commentCount}
          </Text>
        </Pressable>
        <Pressable style={ss.actionBtn} onPress={onShare} hitSlop={6}>
          <Icon name="share" size={19} color={palette.zinc[500]} />
        </Pressable>
      </View>
    </View>
  )
}

// 한 댓글 행(대댓글 포함) — 답글 버튼 탭 시 상위 입력이 답글 모드로 전환
function CommentItem({
  comment,
  onReply,
  replyLabel,
  youLabel,
}: {
  comment: MyComment
  onReply: (id: string) => void
  replyLabel: string
  youLabel: string
}) {
  return (
    <View>
      <View style={ss.commentRow}>
        {/* 작성자(나) 프로필 사진 — 설정한 사진/12지신/기본 순 */}
        <MyProfileAvatar size={34} />
        <View style={{ flex: 1 }}>
          <Text style={ss.commentAuthor}>{youLabel}</Text>
          <Text style={ss.commentText}>{comment.text}</Text>
          <Pressable onPress={() => onReply(comment.id)} hitSlop={6}>
            <Text style={ss.replyBtn}>{replyLabel}</Text>
          </Pressable>
        </View>
      </View>
      {/* 대댓글 — 좌측 들여쓰기 + 작은 프로필 사진 */}
      {comment.replies?.map((r) => (
        <View key={r.id} style={[ss.commentRow, ss.replyRow]}>
          <MyProfileAvatar size={26} />
          <View style={{ flex: 1 }}>
            <Text style={ss.commentAuthor}>{youLabel}</Text>
            <Text style={ss.commentText}>{r.text}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// 댓글 시트 — 내 댓글 목록 + 대댓글 + 입력.
// 키보드 높이만큼 시트를 띄워 입력·목록이 가리지 않게 하고, 등록 후 키보드를 자연히 내린다.
function CommentSheet({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const comments = useFeedStore((s) => (postId ? s.comments[postId] : undefined))
  const addComment = useFeedStore((s) => s.addComment)
  const addReply = useFeedStore((s) => s.addReply)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null) // 답글 대상 댓글 id
  const [kbHeight, setKbHeight] = useState(0)

  // 키보드 높이 추적 — Modal 안에서는 adjustResize가 안 먹으므로 직접 시트를 띄운다
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKbHeight(e.endCoordinates.height),
    )
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // 닫을 때 입력·답글 상태 초기화(다음 열람에 잔여값 방지)
  const close = () => {
    setText('')
    setReplyTo(null)
    Keyboard.dismiss()
    onClose()
  }

  const submit = () => {
    if (!postId || !text.trim()) return
    if (replyTo) addReply(postId, replyTo, text)
    else addComment(postId, text)
    setText('')
    setReplyTo(null)
    Keyboard.dismiss() // 등록 후 키보드를 자연히 내려 입력 영역이 사라지게 함
  }

  const startReply = (id: string) => setReplyTo(id)

  // 키보드가 뜨면 시트 전체를 그 높이만큼 위로 띄워(marginBottom) 입력창이 자판에 완전히 가리지 않게 한다.
  // (paddingBottom만으로는 기기별 window pan과 겹쳐 입력창이 자판 경계에 걸리는 문제가 있었음)
  const sheetLift = kbHeight > 0 ? kbHeight : 0
  const bottomPad = kbHeight > 0 ? 12 : insets.bottom + 14
  const listMaxH = kbHeight > 0 ? 160 : 300

  return (
    <Modal
      visible={!!postId}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent>
      <View style={ss.modalRoot}>
        <Pressable style={ss.backdrop} onPress={close} />
        <View style={[ss.sheet, { marginBottom: sheetLift, paddingBottom: bottomPad }]}>
          <View style={ss.sheetGrab} />
          <Text style={ss.sheetTitle}>{t('travelers.comments')}</Text>
          <ScrollView style={{ maxHeight: listMaxH }} keyboardShouldPersistTaps="handled">
            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onReply={startReply}
                  replyLabel={t('travelers.reply')}
                  youLabel={t('travelers.you')}
                />
              ))
            ) : (
              <Text style={ss.noComments}>{t('travelers.noComments')}</Text>
            )}
          </ScrollView>
          {/* 답글 모드 배너 — 취소 가능 */}
          {replyTo && (
            <View style={ss.replyBanner}>
              <Text style={ss.replyBannerText}>{t('travelers.replyingMode')}</Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Icon name="close" size={15} color={palette.zinc[500]} />
              </Pressable>
            </View>
          )}
          <View style={ss.inputRow}>
            <TextInput
              style={ss.input}
              placeholder={replyTo ? t('travelers.addReply') : t('travelers.addComment')}
              placeholderTextColor={palette.zinc[400]}
              value={text}
              onChangeText={setText}
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            {/* 입력 없으면 X(시트 닫기), 입력하면 등록(전송) 버튼으로 전환 */}
            <Pressable
              style={[ss.sendBtn, !text.trim() && ss.sendBtnClose]}
              onPress={text.trim() ? submit : close}>
              <Icon
                name={text.trim() ? 'arrow_upward' : 'close'}
                size={18}
                color={text.trim() ? '#fff' : palette.zinc[600]}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export function TravelerFeed({
  posts,
  loadingMore,
}: {
  posts: TravelerPost[]
  loadingMore?: boolean
}) {
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const cards = useMemo(
    () => posts.map((p) => <PostCard key={p.id} post={p} onOpenComments={setOpenPostId} />),
    [posts],
  )
  return (
    <View style={{ gap: 12 }}>
      {cards}
      {loadingMore && (
        <View style={ss.footer}>
          <ActivityIndicator color={palette.blue[50]} />
        </View>
      )}
      <CommentSheet postId={openPostId} onClose={() => setOpenPostId(null)} />
    </View>
  )
}

const ss = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  flagBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  flagText: { fontSize: 10 },
  flagInline: { fontSize: 12 },
  name: { fontSize: 13.5, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  meta: { fontSize: 11, color: palette.zinc[500], marginTop: 1 },
  caption: { fontSize: 13, color: palette.zinc[800], lineHeight: 19, marginBottom: 10 },
  imageWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: palette.zinc[100] },
  // 영상 페이지 좌상단 재생 배지
  videoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 미디어 장수 카운터(우상단)
  mediaCount: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mediaCountText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  videoBadgeText: { color: '#fff', fontSize: 10, marginLeft: 2 },
  // 하단 도트 인디케이터
  dots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 7, height: 7 },
  // 장소 바로가기 링크(이미지 하단)
  placeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: palette.blue[90],
    borderRadius: 999,
    paddingLeft: 9,
    paddingRight: 10,
    paddingVertical: 6,
    marginTop: 10,
    maxWidth: '100%',
  },
  placeLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.blue[40],
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 12.5, fontWeight: '700', color: palette.zinc[600] },
  footer: { paddingVertical: 16, alignItems: 'center' },

  // 댓글 시트
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 8,
    // 부드러운 상단 마감 — 살짝 떠 보이도록 상단 그림자
    ...shadows.pop,
  },
  sheetGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.zinc[300],
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: palette.zinc[900], marginBottom: 10 },
  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  meAvatar: { width: 32, height: 32, backgroundColor: palette.blue[50] },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  commentText: { fontSize: 13, color: palette.zinc[700], marginTop: 2, lineHeight: 18 },
  noComments: {
    fontSize: 12.5,
    color: palette.zinc[400],
    textAlign: 'center',
    paddingVertical: 24,
  },
  // 답글(대댓글)
  replyBtn: { fontSize: 11.5, fontWeight: '700', color: palette.blue[50], marginTop: 5 },
  replyRow: { paddingLeft: 30, paddingVertical: 6 }, // 좌측 들여쓰기
  replyAvatar: { width: 24, height: 24, backgroundColor: palette.teal[40] },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.blue[90],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 8,
  },
  replyBannerText: { fontSize: 11.5, fontWeight: '700', color: palette.blue[30] },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    backgroundColor: palette.zinc[100],
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: palette.zinc[900],
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 입력 없음(닫기 X) 상태 — 중립 회색 배경
  sendBtnClose: { backgroundColor: palette.zinc[200] },
})
