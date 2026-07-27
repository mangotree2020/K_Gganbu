-- 전통놀이 본게임 추가 (PRD REQ-GM-1) — 딱지치기(ddakji).
-- 후보(딱지치기·달고나·구슬치기) 중 하나를 프로토타입으로 먼저 낸다(O-3 최종 선정은 지표로).
-- IP 가드레일(REQ-GM-3): 전통놀이 자체는 퍼블릭 도메인이며, 드라마 IP 요소는 쓰지 않는다.
alter table public.game_scores drop constraint if exists game_scores_game_check;
alter table public.game_scores add constraint game_scores_game_check
  check (game in ('tetris', 'rps', 'ddakji'));
