-- Music is retired in favor of spending. The music rows stay so existing answers keep
-- their category and version.
UPDATE category SET active = FALSE WHERE code = 'music';

INSERT INTO category (code, name, icon, description, tagline, minutes, recommend, sort_order) VALUES
    ('spending', '소비 취향', 'payments', '플렉스 vs 짠테크', '지갑이 열리는 순간 드러나는 나', 1,
     ARRAY['장바구니에 물건이 쌓여 있는 분', '플렉스와 짠테크 사이에서 고민하는 분', '친구들 소비 습관이 궁금한 분'], 5);

INSERT INTO category_version (category_id, version, status, published_at)
SELECT id, 1, 'PUBLISHED', now() FROM category WHERE code = 'spending';

INSERT INTO question (category_version_id, bit_position, code, prompt, option_0, option_1)
SELECT v.id, q.bit_position, q.code, q.prompt, q.option_0, q.option_1
FROM (VALUES
    (0, 'spending-01', '월급날엔?', '나에게 선물', '일단 저축'),
    (1, 'spending-02', '사고 싶은 게 생기면?', '바로 산다', '장바구니에 묵힌다'),
    (2, 'spending-03', '쇼핑은?', '온라인', '오프라인'),
    (3, 'spending-04', '물건을 살 땐?', '비싸도 좋은 거', '싸게 여러 개'),
    (4, 'spending-05', '할인 쿠폰은?', '꼭 찾아본다', '귀찮다'),
    (5, 'spending-06', '가계부는?', '쓴다', '안 쓴다'),
    (6, 'spending-07', '배달비는?', '아깝다', '편하면 OK'),
    (7, 'spending-08', '구독 서비스는?', '여러 개', '최소한만'),
    (8, 'spending-09', '더치페이는?', '정확히 나눈다', '번갈아 산다'),
    (9, 'spending-10', '여행 경비는?', '아낌없이', '알뜰하게')
) AS q (bit_position, code, prompt, option_0, option_1)
JOIN category c ON c.code = 'spending'
JOIN category_version v ON v.category_id = c.id AND v.version = 1;
