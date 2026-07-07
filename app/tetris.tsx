// 테트리스 (게임존 1호) — 블록 스킨은 고양이·쥐 이모지 믹스.
// RPS 3판 승리 → 게임존 입장 동선의 첫 게임. 10줄 클리어 시 +10P(earn_game,
// 일 상한 30P 서버 캡 — challenge·game 공유).
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SheetHeader } from '@/components/SheetHeader'
import { useT } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { palette, shadows } from '@/theme/tokens'

const COLS = 9
const ROWS = 14
const TICK_MS = 650

// 블록 스킨 — 고양이·쥐 믹스 (피스마다 하나 배정)
const SKINS = ['🐱', '🐭', '😺', '🐁', '🐈', '🐹'] as const

// 테트로미노 7종 (행렬)
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [0, 1, 0],
    [1, 1, 1],
  ], // T
  [
    [1, 0],
    [1, 0],
    [1, 1],
  ], // L
  [
    [0, 1],
    [0, 1],
    [1, 1],
  ], // J
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // S
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // Z
]

type Piece = { shape: number[][]; x: number; y: number; skin: string }
type Cell = string | null

const emptyBoard = (): Cell[][] => Array.from({ length: ROWS }, () => Array(COLS).fill(null))

const randomPiece = (): Piece => {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  const skin = SKINS[Math.floor(Math.random() * SKINS.length)]
  return { shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0, skin }
}

const rotate = (m: number[][]): number[][] => m[0].map((_, c) => m.map((row) => row[c]).reverse())

const collides = (board: Cell[][], p: Piece): boolean => {
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue
      const x = p.x + c
      const y = p.y + r
      if (x < 0 || x >= COLS || y >= ROWS) return true
      if (y >= 0 && board[y][x]) return true
    }
  }
  return false
}

export default function TetrisScreen() {
  const t = useT()
  const [board, setBoard] = useState<Cell[][]>(emptyBoard)
  const [piece, setPiece] = useState<Piece>(randomPiece)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [over, setOver] = useState(false)
  const [earned, setEarned] = useState<number | null>(null)
  const rewardedRef = useRef(false)
  // 판정은 ref 미러 기반(동기) — setState 비동기 타이밍과 무관하게 정확
  const boardRef = useRef(board)
  const pieceRef = useRef(piece)
  const overRef = useRef(false)

  const setBoardSync = (b: Cell[][]) => {
    boardRef.current = b
    setBoard(b)
  }
  const setPieceSync = (pc: Piece) => {
    pieceRef.current = pc
    setPiece(pc)
  }

  // 피스 이동/회전 시도 — 성공 여부를 동기로 반환
  const tryMove = useCallback((dx: number, dy: number, rotated?: boolean): boolean => {
    if (overRef.current) return false
    const cur = pieceRef.current
    const shape = rotated ? rotate(cur.shape) : cur.shape
    const np = { ...cur, shape, x: cur.x + dx, y: cur.y + dy }
    if (collides(boardRef.current, np)) return false
    setPieceSync(np)
    return true
  }, [])

  // 락 + 줄 클리어 + 새 피스 (전부 동기 ref 기반)
  const lockAndNext = useCallback(() => {
    const cur = pieceRef.current
    const nb = boardRef.current.map((row) => [...row])
    for (let r = 0; r < cur.shape.length; r++) {
      for (let c = 0; c < cur.shape[r].length; c++) {
        if (cur.shape[r][c] && cur.y + r >= 0) nb[cur.y + r][cur.x + c] = cur.skin
      }
    }
    const remain = nb.filter((row) => row.some((cell) => !cell))
    const cleared = ROWS - remain.length
    while (remain.length < ROWS) remain.unshift(Array(COLS).fill(null))
    if (cleared > 0) {
      setLines((l) => l + cleared)
      setScore((s) => s + cleared * cleared * 100)
    }
    setBoardSync(remain)
    const next = randomPiece()
    if (collides(remain, next)) {
      overRef.current = true
      setOver(true)
      return
    }
    setPieceSync(next)
  }, [])

  // 중력 틱
  useEffect(() => {
    if (over) return
    const id = setInterval(() => {
      if (!tryMove(0, 1)) lockAndNext()
    }, TICK_MS)
    return () => clearInterval(id)
  }, [over, tryMove, lockAndNext])

  // 10줄 달성 보상 — 1회 (일 상한은 서버 캡)
  useEffect(() => {
    if (lines >= 10 && !rewardedRef.current) {
      rewardedRef.current = true
      supabase.functions
        .invoke('points', { body: { action: 'earn_game' } })
        .then(({ data }) => {
          if (data?.granted > 0) setEarned(data.granted)
        })
        .catch(() => {})
    }
  }, [lines])

  // 하드드롭 — 바닥까지 즉시 하강 후 고정
  const hardDrop = () => {
    if (overRef.current) return
    let n = 0
    while (tryMove(0, 1) && n < ROWS + 2) n++
    lockAndNext()
  }

  const restart = () => {
    const b = emptyBoard()
    boardRef.current = b
    setBoard(b)
    const pc = randomPiece()
    pieceRef.current = pc
    setPiece(pc)
    setScore(0)
    setLines(0)
    overRef.current = false
    setOver(false)
    setEarned(null)
    rewardedRef.current = false
  }

  // 렌더 보드 = 고정 블록 + 현재 피스 오버레이
  const view = board.map((row) => [...row])
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.y + r >= 0 && piece.y + r < ROWS) {
        view[piece.y + r][piece.x + c] = piece.skin
      }
    }
  }

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <SheetHeader
        title={`🐱 ${t('game.tetris')} 🐭`}
        sub={`${t('game.score')} ${score} · ${t('game.lines')} ${lines}`}
        icon="stadia_controller"
        accent={palette.blue[50]}
        accentBg={palette.blue[95]}
      />
      <View style={ss.body}>
        <View style={[ss.board, shadows.card]}>
          {view.map((row, r) => (
            <View key={r} style={ss.row}>
              {row.map((cell, c) => (
                <View key={c} style={[ss.cell, cell ? ss.cellOn : null]}>
                  {cell ? <Text style={ss.cellEmoji}>{cell}</Text> : null}
                </View>
              ))}
            </View>
          ))}
          {over && (
            <View style={ss.overOverlay}>
              <Text style={{ fontSize: 40 }}>😿</Text>
              <Text style={ss.overTitle}>{t('game.gameOver')}</Text>
              <Text style={ss.overScore}>
                {t('game.score')} {score}
              </Text>
              {earned != null && <Text style={ss.earned}>+{earned}P</Text>}
              <Pressable onPress={restart} style={ss.restartBtn}>
                <Text style={ss.restartText}>{t('game.retry')}</Text>
              </Pressable>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text style={ss.exitText}>{t('game.exit')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* 컨트롤 — 좌/회전/우 + 하드드롭 */}
        <View style={ss.controls}>
          <Pressable onPress={() => tryMove(-1, 0)} style={ss.ctrlBtn}>
            <Text style={ss.ctrlText}>◀</Text>
          </Pressable>
          <Pressable onPress={() => tryMove(0, 0, true)} style={ss.ctrlBtn}>
            <Text style={ss.ctrlText}>🔄</Text>
          </Pressable>
          <Pressable onPress={hardDrop} style={[ss.ctrlBtn, ss.dropBtn]}>
            <Text style={ss.ctrlText}>⬇️</Text>
          </Pressable>
          <Pressable onPress={() => tryMove(1, 0)} style={ss.ctrlBtn}>
            <Text style={ss.ctrlText}>▶</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const CELL = 34

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  body: { flex: 1, alignItems: 'center', paddingTop: 4 },
  board: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 4,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL,
    height: CELL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#33415555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { backgroundColor: '#0EA5E922', borderRadius: 6 },
  cellEmoji: { fontSize: 22 },
  overOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,.86)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  overTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  overScore: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  earned: { color: '#FCD34D', fontSize: 16, fontWeight: '800' },
  restartBtn: {
    marginTop: 8,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  restartText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  exitText: { color: '#94A3B8', fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 14 },
  ctrlBtn: {
    width: 64,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  dropBtn: { backgroundColor: palette.blue[95] },
  ctrlText: { fontSize: 22, color: palette.zinc[800], fontWeight: '800' },
})
