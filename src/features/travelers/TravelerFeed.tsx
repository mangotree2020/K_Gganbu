// 여행자 후기 인스타 스타일 피드 — 프로필 + 리뷰글 + 미디어(다중 이미지·영상) + 장소 링크 + 별/댓글/공유.
// 정렬(시간+거리)과 무한 스크롤 로딩은 상위(홈)에서 posts/loadingMore로 주입한다.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'

import { Icon } from '@/components/brand'
import { CachedImage } from '@/components/CachedImage'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useAuthStore } from '@/features/auth/store'
import { ProfileAvatar as MyProfileAvatar } from '@/features/profile/Avatar'
import { countRows, mergeComments, type CommentRow as CRow, type RemoteComment } from './comments'
import { ageLabel, type MediaItem, type TravelerPost } from './feed'
import { blockAuthorRemote, reportContent } from './moderation'
import {
  useAddCommentRemote,
  useDeleteCommentRemote,
  useEditCommentRemote,
  useFeedCounts,
  useMyUserId,
  usePostComments,
  useToggleLikeRemote,
  type FeedCount,
} from './social'
import { useProfileStore } from '@/features/profile/store'
import { useFeedStore } from './store'
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
    // nativeEvent 방어 — 풀링된 이벤트는 디스패치 후 null이 된다(map.tsx 주석 참조)
    if (w > 0 && e?.nativeEvent?.contentOffset)
      setIdx(Math.round(e.nativeEvent.contentOffset.x / w))
  }
  if (media.length === 0) {
    return (
      <View style={ss.imageWrap}>
        <PlaceThumb category={cat} height={MEDIA_H} />
      </View>
    )
  }
  return (
    // nativeEvent 방어 — 풀링된 이벤트는 디스패치 후 null이 된다(map.tsx 주석 참조)
    <View
      style={ss.imageWrap}
      onLayout={(e) => e?.nativeEvent?.layout && setW(e.nativeEvent.layout.width)}>
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
  serverCount,
}: {
  post: TravelerPost
  onOpenComments: (id: string) => void
  serverCount?: FeedCount
}) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const blockAuthor = useFeedStore((s) => s.blockAuthor)
  const hidePost = useFeedStore((s) => s.hidePost)
  // 신고 = 이 게시물 즉시 가림 + 서버 기록(운영 대응 큐). 사용자를 기다리게 하지 않는다.
  const onReport = () => {
    setMenuOpen(false)
    hidePost(post.id)
    void reportContent({ targetType: 'post', targetId: post.id, reason: 'offensive' })
  }
  const onBlock = () => {
    setMenuOpen(false)
    blockAuthor(post.author)
    void blockAuthorRemote(post.author)
  }
  const liked = useFeedStore((s) => !!s.liked[post.id])
  const myComments = useFeedStore((s) => s.comments[post.id])
  const commentedHere = useFeedStore((s) => !!s.commentedPosts[post.id])
  const toggleLike = useFeedStore((s) => s.toggleLike)
  const likeRemote = useToggleLikeRemote()

  // 서버 집계가 있으면 그 값을 쓰고(다른 사람의 좋아요·댓글까지 반영), 없으면 기존 로컬 계산.
  // 로컬 값을 먼저 그려 탭 반응은 즉시, 서버 값은 뒤따라 덮는다.
  const myCommentCount =
    (myComments?.length ?? 0) + (myComments?.reduce((n, c) => n + (c.replies?.length ?? 0), 0) ?? 0)
  const likeCount = serverCount
    ? serverCount.likes + (liked && !serverCount.liked_by_me ? 1 : 0)
    : post.likes + (liked ? 1 : 0)
  // 로컬 댓글은 게스트(또는 서버 저장 실패 폴백)의 것뿐이라 서버 집계와 겹치지 않는다 →
  // 항상 합산한다. 예전에는 서버 집계가 있으면 로컬을 버려 게스트 댓글이 카드에 안 잡혔다.
  const commentCount = (serverCount?.comments ?? 0) + post.seedComments + myCommentCount
  // 내가 이 후기에 댓글을 남겼는지 — 로그인 사용자의 댓글은 서버에만 있으므로(중복 방지)
  // 로컬 개수만으로는 알 수 없다. 남긴 사실 자체를 따로 기억해 표시에 쓴다.
  const commented = myCommentCount > 0 || commentedHere
  const onToggleLike = () => {
    toggleLike(post.id)
    likeRemote.mutate({ postId: post.id, liked: !liked })
  }

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
        {/* 신고·차단 (REQ-UGC-3) — UGC 화면에는 항상 있어야 하는 탈출구 */}
        <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={10} style={ss.moreBtn}>
          <Text style={ss.moreText}>⋯</Text>
        </Pressable>
      </View>
      {menuOpen && (
        <View style={ss.menu}>
          <Pressable style={ss.menuItem} onPress={onReport}>
            <Icon name="block" size={14} color={palette.error[50]} />
            <Text style={ss.menuText}>{t('ugc.report')}</Text>
          </Pressable>
          <Pressable style={ss.menuItem} onPress={onBlock}>
            <Icon name="person" size={14} color={palette.zinc[600]} />
            <Text style={[ss.menuText, { color: palette.zinc[700] }]}>
              {t('ugc.block').replace('{name}', post.author)}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 리뷰글 */}
      <Text style={ss.caption}>{post.text}</Text>

      {/* 미디어 영역 — 이미지 여러 장 + 영상 캐러셀 */}
      <MediaCarousel media={post.media} cat={post.cat} />

      {/* 액션: 별(좋아요) / 댓글 / 공유 + 우측 장소 바로가기(아이콘만 — 장소명은 프로필에 이미 표시) */}
      <View style={ss.actions}>
        <Pressable style={ss.actionBtn} onPress={onToggleLike} hitSlop={6}>
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
        {/* 장소 바로가기 → 장소 상세로 이동 (우측 정렬, 아이콘만) */}
        {post.lat != null && post.lng != null && (
          <Pressable style={ss.placeLinkBtn} onPress={() => goToPlace(post)} hitSlop={8}>
            <Icon name="location_on" size={20} color={palette.blue[50]} filled />
          </Pressable>
        )}
      </View>
    </View>
  )
}

// 댓글 작성자 아바타(타인) — 카드 헤더와 같은 이름→색 규칙을 써서 같은 사람이 같은 색으로 보인다.
// (예전에는 서버 댓글에 아바타가 아예 없어 한 목록 안에 두 가지 모양이 섞였다)
function CommentAvatar({ name, size }: { name: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  )
}

// 댓글 한 줄 — 아바타 + 이름·시간 + 본문 + 액션(답글/수정/삭제).
// 액션은 아이콘으로 통일한다 — 27개 UI 언어에서 텍스트 버튼은 길이가 제각각이라
// 줄이 밀리고, 파란 링크 텍스트는 눌러야 할 것으로 잘 읽히지도 않았다.
function CommentRow({
  row,
  depth,
  onReply,
  onEdit,
  onDelete,
  labels,
}: {
  row: CRow
  depth: 0 | 1
  onReply?: (id: string, author: string) => void
  onEdit?: (row: CRow) => void
  onDelete?: (row: CRow) => void
  labels: { reply: string; edit: string; del: string; you: string; justNow: string }
}) {
  const size = depth === 0 ? 34 : 26
  return (
    <View style={[ss.cRow, depth === 1 && ss.cReplyRow]}>
      {row.mine ? <MyProfileAvatar size={size} /> : <CommentAvatar name={row.author} size={size} />}
      <View style={{ flex: 1 }}>
        <View style={ss.cMetaLine}>
          <Text style={ss.cAuthor} numberOfLines={1}>
            {row.author}
          </Text>
          {row.mine && (
            <View style={ss.cYouPill}>
              <Text style={ss.cYouText}>{labels.you}</Text>
            </View>
          )}
          <Text style={ss.cTime}>{ageLabel(row.ageMin, labels.justNow)}</Text>
        </View>
        {!!row.replyToName && <Text style={ss.cReplyTo}>@{row.replyToName}</Text>}
        <Text style={ss.cBody}>{row.body}</Text>
        <View style={ss.cActions}>
          {onReply && (
            <Pressable
              onPress={() => onReply(row.id, row.author)}
              hitSlop={8}
              style={ss.cActionBtn}
              accessibilityRole="button"
              accessibilityLabel={labels.reply}>
              <Icon name="reply" size={15} color={palette.zinc[500]} />
            </Pressable>
          )}
          {/* 수정·삭제는 내 댓글에만 — 남의 댓글에 눌리지 않을 버튼을 보여주지 않는다 */}
          {row.mine && onEdit && (
            <Pressable
              onPress={() => onEdit(row)}
              hitSlop={8}
              style={ss.cActionBtn}
              accessibilityRole="button"
              accessibilityLabel={labels.edit}>
              <Icon name="edit" size={15} color={palette.zinc[500]} />
            </Pressable>
          )}
          {row.mine && onDelete && (
            <Pressable
              onPress={() => onDelete(row)}
              hitSlop={8}
              style={ss.cActionBtn}
              accessibilityRole="button"
              accessibilityLabel={labels.del}>
              <Icon name="delete" size={15} color={palette.coral[50]} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}

// 댓글 시트 — 서버 댓글과 (게스트의) 로컬 댓글을 시간순 한 목록으로 보여준다.
// 서버 댓글 id 판별 — 로컬 댓글 id 는 `local:...` 형태라 형식으로 구분된다
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// 입력 상한 — 제출 후 서버에서야 잘리는 것보다 입력 단계에서 막는 편이 낫다
const MAX_COMMENT = 300

function CommentSheet({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const user = useAuthStore((s) => s.user)
  // 계정이 있으면 서버가 원본, 게스트는 로컬이 원본 — 한 댓글이 양쪽에 저장돼 두 번 보이지 않게
  // 저장처를 하나로 고정한다(중복 표시의 근본 원인이었다).
  const isGuest = !user || user.isGuest
  const localComments = useFeedStore((s) => (postId ? s.comments[postId] : undefined))
  const addComment = useFeedStore((s) => s.addComment)
  const addReply = useFeedStore((s) => s.addReply)
  const pruneSynced = useFeedStore((s) => s.pruneSynced)
  const markCommented = useFeedStore((s) => s.markCommented)
  const { data: remoteComments, isLoading, isError, refetch } = usePostComments(postId)
  const addRemote = useAddCommentRemote()
  const editRemote = useEditCommentRemote()
  const deleteRemote = useDeleteCommentRemote()
  const { data: myUserId } = useMyUserId()
  const editLocal = useFeedStore((s) => s.editLocalComment)
  const deleteLocal = useFeedStore((s) => s.deleteLocalComment)
  const myName = useProfileStore((s) => s.displayName) || 'Traveler'
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  // 수정 중인 내 댓글 — 입력창이 수정 모드로 바뀐다(별도 화면 없이 같은 자리에서 고친다)
  const [editing, setEditing] = useState<{ id: string; local: boolean } | null>(null)
  const [kbHeight, setKbHeight] = useState(0)
  // 경과 시간 기준 시각 — 렌더 중 Date.now()를 부르면 렌더가 비순수해진다(목록 갱신 때만 새로 잡는다)
  const [now, setNow] = useState(Date.now)
  // 전송했지만 아직 서버 목록에 안 잡힌 내 댓글 — 쿼리 캐시에 끼워 넣으면 다른 전송의
  // 재조회가 통째로 덮어써 사라진다. 시트가 직접 들고 있다가 서버에 나타나면 뺀다.
  const [pending, setPending] = useState<RemoteComment[]>([])
  // 직전 전송(본문·시각) — 습관적 연타나 이벤트 중복으로 같은 댓글이 두 번 올라가지 않게 한다
  const lastSentRef = useRef<{ body: string; at: number }>({ body: '', at: 0 })

  // 다음 틱으로 미뤄 실행(이펙트 내 동기 setState로 인한 연쇄 렌더 방지 — ai.tsx와 동일 패턴)
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0)
    return () => clearTimeout(id)
  }, [postId, remoteComments, localComments])

  // 서버에 반영된 전송분은 pending에서 뺀다(같은 댓글이 두 줄로 보이지 않게)
  useEffect(() => {
    if (!pending.length) return
    const landed = new Set((remoteComments ?? []).map((c) => `${c.author}::${c.body}`))
    const next = pending.filter((p) => !landed.has(`${p.author}::${p.body}`))
    if (next.length === pending.length) return
    // 다음 틱으로 미뤄 실행(이펙트 내 동기 setState로 인한 연쇄 렌더 방지)
    const id = setTimeout(() => setPending(next), 0)
    return () => clearTimeout(id)
  }, [remoteComments, pending])

  // 시트를 닫거나 다른 글로 옮기면 전송 대기 목록은 비운다
  useEffect(() => {
    const id = setTimeout(() => setPending([]), 0)
    return () => clearTimeout(id)
  }, [postId])

  // 이전 버전이 같은 댓글을 서버·로컬 양쪽에 저장해 둔 기기 자가 복구 —
  // 내 이름으로 서버에 올라간 본문과 같은 로컬 댓글은 지운다(중복 표시 제거).
  useEffect(() => {
    if (!postId || !remoteComments?.length) return
    const mine = remoteComments
      .filter((c) => c.author === myName)
      .map((c) => ({ body: c.body, ts: new Date(c.createdAt).getTime() }))
    if (mine.length) pruneSynced(postId, mine)
  }, [postId, remoteComments, myName, pruneSynced])

  // 서버 + 로컬을 하나의 트리로 — 조립 규칙은 comments.ts(순수 로직·단위 테스트)
  const rows = useMemo<CRow[]>(
    () =>
      mergeComments(
        [
          ...(remoteComments ?? []).map((c) => ({
            id: c.id,
            author: c.author,
            parentId: c.parentId,
            body: c.body,
            createdAt: c.createdAt,
          })),
          ...pending,
        ],
        localComments ?? [],
        myName,
        now,
        myUserId,
      ),
    [remoteComments, pending, localComments, myName, now, myUserId],
  )
  const total = useMemo(() => countRows(rows), [rows])

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
    setEditing(null)
    Keyboard.dismiss()
    onClose()
  }

  const labels = {
    reply: t('travelers.reply'),
    edit: t('travelers.edit'),
    del: t('travelers.delete'),
    you: t('travelers.you'),
    justNow: t('travelers.justNow'),
  }

  // 수정 — 본문을 입력창에 채우고 모드를 바꾼다(답글 모드와 상호 배타)
  const startEdit = (row: CRow) => {
    setReplyTo(null)
    setEditing({ id: row.id, local: row.local })
    setText(row.body)
  }

  const cancelEdit = () => {
    setEditing(null)
    setText('')
  }

  // 삭제 — 되돌릴 수 없고 답글까지 사라지므로 반드시 확인을 받는다
  const confirmDelete = (row: CRow) => {
    if (!postId) return
    Alert.alert(t('travelers.deleteTitle'), t('travelers.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('travelers.delete'),
        style: 'destructive',
        onPress: () => {
          if (editing?.id === row.id) cancelEdit()
          if (row.local) deleteLocal(postId, row.id)
          else {
            setPending((p) => p.filter((c) => c.id !== row.id))
            if (!row.id.startsWith('tmp:')) deleteRemote.mutate({ id: row.id, postId })
          }
        },
      },
    ])
  }

  const submit = () => {
    const body = text.trim()
    if (!postId || !body) return
    // 수정 모드 — 새 댓글을 만들지 않고 기존 행을 고친다
    if (editing) {
      if (editing.local) editLocal(postId, editing.id, body)
      else editRemote.mutate({ id: editing.id, postId, body })
      setEditing(null)
      setText('')
      Keyboard.dismiss()
      return
    }
    const nowMs = Date.now()
    const last = lastSentRef.current
    if (last.body === body && nowMs - last.at < 1000) return // 같은 내용 연타 방지
    lastSentRef.current = { body, at: nowMs }
    const target = replyTo
    // 답글 대상이 로컬 댓글이면(게스트 시절 기록 등) 서버에 루트로 저장되지 않도록 로컬에 붙인다
    const localTarget = !!target && !UUID_RE.test(target.id)
    if (isGuest || localTarget) {
      if (target && localTarget) addReply(postId, target.id, body)
      else addComment(postId, body, `local:${Date.now()}`, target?.author)
      markCommented(postId)
    } else {
      const parentId = target ? target.id : null
      const optimistic: RemoteComment = {
        id: `tmp:${Date.now()}`,
        author: myName,
        parentId,
        body,
        createdAt: new Date().toISOString(),
      }
      setPending((p) => [...p, optimistic])
      const dropPending = () => setPending((p) => p.filter((c) => c.id !== optimistic.id))
      addRemote.mutate(
        { postId, body, authorName: myName, parentId },
        {
          // 서버가 저장을 건너뛴 경우(세션 해석 실패 등)는 예외가 아니라 null이 온다.
          // 그대로 두면 다음 재조회에서 댓글이 소리 없이 사라지므로 로컬로 받아둔다.
          onSuccess: (res) => {
            if (res) {
              markCommented(postId)
              return
            }
            dropPending()
            addComment(postId, body, `local:${Date.now()}`, target?.author)
            markCommented(postId)
          },
          onError: dropPending,
        },
      )
    }
    setText('')
    setReplyTo(null)
    Keyboard.dismiss() // 등록 후 키보드를 자연히 내려 입력 영역이 사라지게 함
  }

  // 키보드가 뜨면 그 높이 + 여유(자동완성 툴바까지 확실히 넘도록)만큼 입력창을 자판 위로 올린다.
  const KB_CLEARANCE = 52 // 자동완성 툴바·여백 버퍼
  const bottomPad = kbHeight > 0 ? kbHeight + KB_CLEARANCE : insets.bottom + 14
  // 목록 높이는 화면 비율로 — 고정값(300/150)은 큰 화면에서 시트를 쓸데없이 좁게 만들었다
  const listMaxH = kbHeight > 0 ? Math.max(140, winH * 0.28) : winH * 0.5

  return (
    <Modal visible={!!postId} transparent animationType="slide" onRequestClose={close}>
      <View style={ss.modalRoot}>
        <Pressable style={ss.backdrop} onPress={close} />
        <View style={[ss.sheet, { paddingBottom: bottomPad }]}>
          <View style={ss.sheetGrab} />
          <View style={ss.sheetHead}>
            <Text style={ss.sheetTitle}>
              {t('travelers.comments')}
              {total > 0 ? ` ${total}` : ''}
            </Text>
            <Pressable
              onPress={close}
              hitSlop={10}
              style={ss.sheetClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <Icon name="close" size={16} color={palette.zinc[500]} />
            </Pressable>
          </View>
          {isLoading && rows.length === 0 ? (
            <View style={ss.cLoading}>
              <ActivityIndicator color={palette.blue[50]} />
            </View>
          ) : isError && rows.length === 0 ? (
            // 오류를 "댓글 없음"으로 보여주면 사용자는 글이 없는 줄 안다 — 재시도를 준다
            <View style={ss.cEmpty}>
              <Icon name="wifi_off" size={26} color={palette.zinc[300]} />
              <Text style={ss.noComments}>{t('common.loadFailed')}</Text>
              <Pressable onPress={() => refetch()} style={ss.retryBtn} hitSlop={6}>
                <Text style={ss.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : rows.length === 0 ? (
            <View style={ss.cEmpty}>
              <Icon name="sms" size={28} color={palette.zinc[300]} />
              <Text style={ss.noComments}>{t('travelers.noComments')}</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: listMaxH }} keyboardShouldPersistTaps="handled">
              {rows.map((r, i) => (
                <View key={r.id} style={i > 0 ? ss.cThread : undefined}>
                  <CommentRow
                    row={r}
                    depth={0}
                    onReply={(id, author) => setReplyTo({ id, author })}
                    onEdit={startEdit}
                    onDelete={confirmDelete}
                    labels={labels}
                  />
                  {r.replies.map((rr) => (
                    <CommentRow
                      key={rr.id}
                      row={rr}
                      depth={1}
                      onEdit={startEdit}
                      onDelete={confirmDelete}
                      labels={labels}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
          {/* 모드 배너 — 지금 무엇을 하는 중인지(답글/수정) 보여주고 취소 가능 */}
          {(replyTo || editing) && (
            <View style={ss.replyBanner}>
              <Text style={ss.replyBannerText} numberOfLines={1}>
                {editing
                  ? t('travelers.editingMode')
                  : `${t('travelers.replyingMode')} · @${replyTo?.author ?? ''}`}
              </Text>
              <Pressable
                onPress={() => (editing ? cancelEdit() : setReplyTo(null))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}>
                <Icon name="close" size={15} color={palette.zinc[500]} />
              </Pressable>
            </View>
          )}
          <View style={ss.inputRow}>
            <TextInput
              style={ss.input}
              placeholder={
                editing
                  ? t('travelers.editingMode')
                  : replyTo
                    ? t('travelers.addReply')
                    : t('travelers.addComment')
              }
              placeholderTextColor={palette.zinc[400]}
              value={text}
              onChangeText={(v) => setText(v.slice(0, MAX_COMMENT))}
              onSubmitEditing={submit}
              returnKeyType="send"
              multiline
              maxLength={MAX_COMMENT}
              accessibilityLabel={replyTo ? t('travelers.addReply') : t('travelers.addComment')}
            />
            {/* 전송 전용 — 닫기는 헤더 X·배경 탭이 담당한다(한 버튼이 두 일을 하지 않게) */}
            {/* 전송은 touch-down(onPressIn)에서 확정한다.
                버튼을 누르면 입력이 blur되며 키보드가 내려가고, 그 순간 시트 padding이 줄어
                버튼이 손가락 아래에서 밀려나 touch-up(onPress)이 빗나갔다 —
                "등록하려면 두 번 눌러야 하는" 문제의 원인. */}
            <Pressable
              style={[ss.sendBtn, !text.trim() && ss.sendBtnOff]}
              onPressIn={submit}
              disabled={!text.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('travelers.addComment')}
              accessibilityState={{ disabled: !text.trim() }}>
              <Icon
                name={editing ? 'check_circle' : 'arrow_upward'}
                size={18}
                color={text.trim() ? '#fff' : palette.zinc[400]}
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
  // 차단한 작성자·신고로 가린 글은 목록에서 제외 (REQ-UGC-3)
  const blocked = useFeedStore((s) => s.blocked)
  const hidden = useFeedStore((s) => s.hidden)
  const shown = useMemo(
    () => posts.filter((p) => !blocked[p.author] && !hidden[p.id]),
    [posts, blocked, hidden],
  )
  // 화면에 있는 포스트의 좋아요·댓글 수를 한 번에 조회 (REQ-UGC-2)
  const { data: counts } = useFeedCounts(shown.map((p) => p.id))
  const cards = useMemo(
    () =>
      shown.map((p) => (
        <PostCard key={p.id} post={p} onOpenComments={setOpenPostId} serverCount={counts?.[p.id]} />
      )),
    [shown, counts],
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
  moreBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  moreText: { fontSize: 18, color: palette.zinc[400], fontWeight: '800' },
  menu: {
    backgroundColor: palette.zinc[50],
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 6,
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  menuText: { fontSize: 13, fontWeight: '700', color: palette.error[50] },
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
  // 장소 바로가기(아이콘만) — 액션 줄 우측 정렬
  placeLinkBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.blue[90],
    alignItems: 'center',
    justifyContent: 'center',
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
  noComments: {
    fontSize: 12.5,
    color: palette.zinc[400],
    textAlign: 'center',
    paddingVertical: 24,
  },
  // 답글(대댓글)
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

  // ── 댓글 시트 ──
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cRow: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  // 대댓글 — 들여쓰기 + 좌측 레일로 관계를 눈에 보이게
  cReplyRow: {
    marginLeft: 17,
    paddingLeft: 15,
    borderLeftWidth: 2,
    borderLeftColor: palette.zinc[200],
  },
  cMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cAuthor: { fontSize: 12.5, fontWeight: '800', color: palette.zinc[900], flexShrink: 1 },
  cYouPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: palette.blue[95],
  },
  cYouText: { fontSize: 9.5, fontWeight: '800', color: palette.blue[50] },
  cTime: { fontSize: 11, color: palette.zinc[400] },
  cReplyTo: { fontSize: 11.5, fontWeight: '700', color: palette.blue[50], marginTop: 2 },
  cBody: { fontSize: 13.5, color: palette.zinc[700], marginTop: 3, lineHeight: 19 },
  // 액션(답글·수정·삭제) — 아이콘 버튼. 최소 탭 영역을 확보한다
  cActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  cActionBtn: { paddingVertical: 7, paddingHorizontal: 8 },
  // 스레드 사이 구분선 — 대댓글까지 한 덩어리로 읽히게
  cThread: { borderTopWidth: 1, borderTopColor: palette.zinc[100] },
  cLoading: { paddingVertical: 34, alignItems: 'center' },
  cEmpty: { paddingVertical: 26, alignItems: 'center', gap: 8 },
  sendBtnOff: { backgroundColor: palette.zinc[100] },
  retryBtn: {
    marginTop: 2,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
  },
  retryText: { fontSize: 12, fontWeight: '800', color: palette.zinc[700] },
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
})
