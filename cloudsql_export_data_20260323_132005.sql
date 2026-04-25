--
-- PostgreSQL database dump
--

\restrict JLpviSP7EIdLDjLFxPSu007TdNnbWdQPymLhzene3tWWP7TnisjWPnQwpZIXJOJ

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_settings (key, value) VALUES ('order_seq_next_2026-03-03', '2');
INSERT INTO public.app_settings (key, value) VALUES ('order_seq_start_2026-03-04', '1');
INSERT INTO public.app_settings (key, value) VALUES ('order_seq_next_2026-03-04', '2');
INSERT INTO public.app_settings (key, value) VALUES ('order_seq_next_2026-03-17', '2');
INSERT INTO public.app_settings (key, value) VALUES ('line_replies_2026-03', '33');
INSERT INTO public.app_settings (key, value) VALUES ('order_seq_next_2026-03-23', '2');


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nujd_8rea6pq9', '蘭嶼高中-早餐', '32', 'AS2013-1', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuji_cahog0kt', '蘭嶼高中-晚餐', '33', 'AS2013-2', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nul1_h2p8u419', '桃園國中', '46', 'AS3002', NULL, NULL, '561175', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nulb_quhoz7rv', '桃源國小(早晚)', '48', 'AS3003-1', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuo5_j208q4q0', '海端日照', '69', 'AS3023-1', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nufk_qtgpq1ab', '知本國中', '10000405', 'AS1003', NULL, NULL, '詹雅如', NULL, NULL, 1, '2026-02-28 08:13:33.255574+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nufo_xekd320l', '康樂國小', '10000406', 'AS1005', NULL, NULL, '張淑卿', NULL, NULL, 1, '2026-02-28 08:13:33.259846+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nufu_j7fxh0o7', '豐榮國小', '10000407', 'AS1007', NULL, NULL, '韓秉翊', NULL, NULL, 1, '2026-02-28 08:13:33.265696+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nufz_yc6lh6xm', '豐年國小', '10000408', 'AS1008', NULL, NULL, '林玫渝', NULL, NULL, 1, '2026-02-28 08:13:33.270325+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nug8_mmk9zaku', '豐里國小', '10000410', 'AS1011', NULL, NULL, '廖盈翔', NULL, NULL, 1, '2026-02-28 08:13:33.280815+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nugd_aqbkjdbx', '知本國小', '10000411', 'AS1012', NULL, NULL, '陳重良', NULL, NULL, 1, '2026-02-28 08:13:33.285819+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nugi_fmeis7yh', '溫泉國小', '10000412', 'AS1013', NULL, NULL, '張碧蓉', NULL, NULL, 1, '2026-02-28 08:13:33.290845+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nugs_i86hteon', '太平國小', '10000414', 'AS1016', NULL, NULL, '林彩足', NULL, NULL, 1, '2026-02-28 08:13:33.299586+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nugx_2d0wbo28', '利嘉國小', '10000415', 'AS1017', NULL, NULL, '潘雅馨', NULL, NULL, 1, '2026-02-28 08:13:33.303791+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuh0_85fk1skp', '豐源國小', '10000416', 'AS1018', NULL, NULL, '陳原銘', NULL, NULL, 1, '2026-02-28 08:13:33.307694+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuh4_fkm74i3l', '仁愛國小', '10000417', 'AS1019', NULL, NULL, '陳鵬貴', NULL, NULL, 1, '2026-02-28 08:13:33.311985+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuh8_7b5p57ew', '公館國小', '10000418', 'AS1020', NULL, NULL, '施秉杰', NULL, NULL, 1, '2026-02-28 08:13:33.316337+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuhd_2zwddiun', '綠島國中', '10000419', 'AS1021', NULL, NULL, '黃正吉', NULL, NULL, 1, '2026-02-28 08:13:33.320455+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuhi_7qqdufvs', '綠島國小', '10000420', 'AS1022', NULL, NULL, '高惠美', NULL, NULL, 1, '2026-02-28 08:13:33.324753+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuhn_gxgdxf9z', '寶桑國中', '10000421', 'AS2001', NULL, NULL, 'anne852088@gmail.com', NULL, NULL, 1, '2026-02-28 08:13:33.329042+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuhr_uner03v1', '都蘭國中', '10000422', 'AS2002', NULL, NULL, '黃午秘', NULL, NULL, 1, '2026-02-28 08:13:33.333642+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nui0_gedd8sbr', '富岡國小', '10000424', 'AS2004', NULL, NULL, '蔡育庭', NULL, NULL, 1, '2026-02-28 08:13:33.342042+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nui6_w64ait5d', '富山國小', '10000425', 'AS2005', NULL, NULL, '李麗君', NULL, NULL, 1, '2026-02-28 08:13:33.346381+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuia_66ghiple', '興隆國小', '10000426', 'AS2006', NULL, NULL, '劉慧君', NULL, NULL, 1, '2026-02-28 08:13:33.350623+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuif_6htdjukx', '都蘭國小', '10000427', 'AS2007', NULL, NULL, '陳麗芳', NULL, NULL, 1, '2026-02-28 08:13:33.354559+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuil_1wsurx75', '寶桑國小', '10000428', 'AS2008', NULL, NULL, '陳秋燕', NULL, NULL, 1, '2026-02-28 08:13:33.35792+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuip_2fo1l401', '泰源國中', '10000429', 'AS2009', NULL, NULL, '游雅鈞', NULL, NULL, 1, '2026-02-28 08:13:33.361972+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuiu_nbc1f8wv', '泰源國小', '10000430', 'AS2010', NULL, NULL, '范家玲', NULL, NULL, 1, '2026-02-28 08:13:33.365694+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuiz_wossu1nv', '北源國小', '10000431', 'AS2011', NULL, NULL, '劉宥讌', NULL, NULL, 1, '2026-02-28 08:13:33.369846+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuj8_d80b7r7c', '蘭嶼高中', '10000433', 'AS2013', NULL, NULL, '陳羽傑', NULL, NULL, 1, '2026-02-28 08:13:33.377772+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nujm_szegat0q', '蘭嶼國小', '10000434', 'AS2014', NULL, NULL, '蘇桂君', NULL, NULL, 1, '2026-02-28 08:13:33.381834+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nujq_ytjzue2v', '椰油國小', '10000435', 'AS2015', NULL, NULL, NULL, NULL, NULL, 1, '2026-02-28 08:13:33.385546+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuju_8w974qvq', '朗島國小', '10000436', 'AS2016', NULL, NULL, '732018', NULL, NULL, 1, '2026-02-28 08:13:33.389877+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nujx_znrhyelp', '東清國小', '10000437', 'AS2017', NULL, NULL, '陳雅琳', NULL, NULL, 1, '2026-02-28 08:13:33.394172+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuk2_290x7a08', '卑南國中', '10000438', 'AS2018', NULL, NULL, '周靜閔', NULL, NULL, 1, '2026-02-28 08:13:33.39851+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuk6_u3vc65dh', '卑南國小', '10000439', 'AS2019', NULL, NULL, '蕭淑丹', NULL, NULL, 1, '2026-02-28 08:13:33.415053+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nukf_zoar2v1y', '東成國小', '10000441', 'AS2022', NULL, NULL, '林老師', NULL, NULL, 1, '2026-02-28 08:13:33.423636+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nukk_thhpzxsn', '賓朗國小', '10000442', 'AS2023', NULL, NULL, '張育綠', NULL, NULL, 1, '2026-02-28 08:13:33.428046+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nukp_9elbezq9', '初鹿國小', '10000443', 'AS2024', NULL, NULL, '謝勝利', NULL, NULL, 1, '2026-02-28 08:13:33.432777+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nukt_vunfs3zt', '初鹿國中', '10000444', 'AS2025', NULL, NULL, '尤美珠', NULL, NULL, 1, '2026-02-28 08:13:33.43656+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nukx_33rkwx09', '紅葉國小', '10000445', 'AS3001', NULL, NULL, '許珍慈', NULL, NULL, 1, '2026-02-28 08:13:33.440481+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nul6_vnojezgz', '桃源國小', '10000447', 'AS3003', NULL, NULL, '陳虹穎', NULL, NULL, 1, '2026-02-28 08:13:33.448574+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nulf_tgccn7uo', '龍田國小', '10000448', 'AS3004', NULL, NULL, '謝老師', NULL, NULL, 1, '2026-02-28 08:13:33.452493+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nult_t3vz1xy7', '鹿野國中', '10000449', 'AS3005', NULL, NULL, '陳薏如', NULL, NULL, 1, '2026-02-28 08:13:33.456136+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61num2_unkqfxp0', '鸞山國小', '10000451', 'AS3007', NULL, NULL, '胡瑞蓮', NULL, NULL, 1, '2026-02-28 08:13:33.464216+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61num6_yz480kc7', '永安國小', '10000452', 'AS3008', NULL, NULL, '詹金鑾', NULL, NULL, 1, '2026-02-28 08:13:33.468704+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61numa_r0xa4l5g', '武陵國小', '10000453', 'AS3009', NULL, NULL, '張邑光', NULL, NULL, 1, '2026-02-28 08:13:33.473032+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nume_e0cz3xjo', '瑞源國中', '10000454', 'AS3010', NULL, NULL, '關午秘', NULL, NULL, 1, '2026-02-28 08:13:33.477251+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61numj_0mb857y8', '瑞源國小', '10000455', 'AS3011', NULL, NULL, '陳良侃', NULL, NULL, 1, '2026-02-28 08:13:33.482292+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61numm_3vf3w2fk', '瑞豐國小', '10000456', 'AS3012', NULL, NULL, '580059', NULL, NULL, 1, '2026-02-28 08:13:33.486877+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61numr_4zk0ic4p', '關山國中', '10000457', 'AS3013', NULL, NULL, '顏老師', NULL, NULL, 1, '2026-02-28 08:13:33.491398+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61numz_gzurbcsx', '月眉國小', '10000459', 'AS3015', NULL, NULL, '余老師', NULL, NULL, 1, '2026-02-28 08:13:33.499898+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nun3_59gm3gu9', '德高國小', '10000460', 'AS3016', NULL, NULL, '徐甄苓', NULL, NULL, 1, '2026-02-28 08:13:33.504216+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nun7_4q5d7ijm', '電光國小', '10000461', 'AS3017', NULL, NULL, '傅校護', NULL, NULL, 1, '2026-02-28 08:13:33.508983+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nunc_5f6fxbj7', '加拿國小', '10000462', 'AS3018', NULL, NULL, '鍾明靜', NULL, NULL, 1, '2026-02-28 08:13:33.51358+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nunf_71n6ee6b', '崁頂國小', '10000463', 'AS3019', NULL, NULL, '何校護', NULL, NULL, 1, '2026-02-28 08:13:33.517678+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nunm_mlgyk1ls', '海端國中', '10000464', 'AS3020', NULL, NULL, '931488', NULL, NULL, 1, '2026-02-28 08:13:33.522041+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nunr_ckuvkmgl', '海端國小', '10000465', 'AS3021', NULL, NULL, '沈雪娥', NULL, NULL, 1, '2026-02-28 08:13:33.526163+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nunv_tvun8k59', '初來國小', '10000466', 'AS3022', NULL, NULL, '鍾美雲', NULL, NULL, 1, '2026-02-28 08:13:33.531269+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuoa_2eqa77xy', '廣原國小', '10000468', 'AS3024', NULL, NULL, '羅慧君', NULL, NULL, 1, '2026-02-28 08:13:33.538773+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuof_t2qppz9r', '霧鹿國小', '10000469', 'AS3025', NULL, NULL, '饒素琴', NULL, NULL, 1, '2026-02-28 08:13:33.542677+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuoj_bcaoj3xs', '利稻國小', '10000470', 'AS3026', NULL, NULL, '林喬綺', NULL, NULL, 1, '2026-02-28 08:13:33.547235+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuop_k076cjla', '池上國中', '10000471', 'AS3027', NULL, NULL, '陳鴻墩', NULL, NULL, 1, '2026-02-28 08:13:33.551652+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuov_zqk889nq', '福原國小', '10000472', 'AS3028', NULL, NULL, '蘇小姐', NULL, NULL, 1, '2026-02-28 08:13:33.555622+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nup0_23suwers', '萬安國小', '10000473', 'AS3029', NULL, NULL, '林淑蓮', NULL, NULL, 1, '2026-02-28 08:13:33.559067+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nup5_l790ce9u', '大坡國小', '10000474', 'AS3030', NULL, NULL, '陳怡如', NULL, NULL, 1, '2026-02-28 08:13:33.562957+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nupa_jad0kxfc', '台東高中', '10000476', 'AS4001', NULL, NULL, NULL, NULL, NULL, 1, '2026-02-28 08:13:33.571155+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nupf_5tl072zm', '部落教保', '10000477', 'AS4002', NULL, NULL, '陳映竹', NULL, NULL, 1, '2026-02-28 08:13:33.575349+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nups_kxfnmn4f', '豐田國中棒球隊', '81', 'AS5001-1', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nupx_29efk2cz', '豐田國中足球隊', '82', 'AS5001-2', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nurb_2uk2xofn', '馬蘭榮家', '94', 'AS6002', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nurg_nxz0wiju', '衛生福利部台東醫院成功分院', '95', 'AS6003', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nupo_dfznwhof', '豐田國中', '10000479', 'AS5001', NULL, NULL, '382511', NULL, NULL, 1, '2026-02-28 08:13:33.584239+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuq1_c8ecwofj', '豐田國小', '10000480', 'AS5002', NULL, NULL, '李淑芬', NULL, NULL, 1, '2026-02-28 08:13:33.588281+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqb_mpqd31z7', '建和國小', '10000482', 'AS5004', NULL, NULL, '510477 / min0360@gmail.com', NULL, NULL, 1, '2026-02-28 08:13:33.597456+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqf_dugylp4u', '光明國小', '10000483', 'AS5005', NULL, NULL, '史小姐', NULL, NULL, 1, '2026-02-28 08:13:33.601515+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqj_u8kntda8', '育仁中學', '10000484', 'AS5006', NULL, NULL, '余小姐', NULL, NULL, 1, '2026-02-28 08:13:33.605584+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqn_wva0i4wy', '台東女中', '10000485', 'AS5007', NULL, NULL, '陳鴻墩', NULL, NULL, 1, '2026-02-28 08:13:33.609473+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqr_4ddya8am', '品格英語學院', '10000486', 'AS5008', NULL, NULL, '黃校護', NULL, NULL, 1, '2026-02-28 08:13:33.613483+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqv_h9kdo4zv', '台東大學附屬特殊教育學校', '10000487', 'AS5009', NULL, NULL, '饒素琴', NULL, NULL, 1, '2026-02-28 08:13:33.617451+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nur3_4cbnz0ya', '大潤發台東店', '10000489', 'AS5011', NULL, NULL, '張碧娟', NULL, NULL, 1, '2026-02-28 08:13:33.625132+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nur8_2u09y8mg', '衛生福利部台東醫院', '10000490', 'AS6001', NULL, NULL, '羅慧君', NULL, NULL, 1, '2026-02-28 08:13:33.628904+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nurk_b349shfc', '賓茂國中', '10000493', 'AS6004', NULL, NULL, '南佳青', NULL, NULL, 1, '2026-02-28 08:13:33.640271+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nurn_9fkswgaf', '台東縣海端鄉立托兒所', '10000495', 'AY0001', NULL, NULL, '林喬綺', NULL, NULL, 1, '2026-02-28 08:13:33.64819+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nurv_8hhj5n0d', '光明國小附設幼兒園', '10000497', 'AY0003', NULL, NULL, '王唯菱', NULL, NULL, 1, '2026-02-28 08:13:33.655768+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nus0_padybhts', '康樂國小附設幼兒園', '10000498', 'AY0004', NULL, NULL, '李正如', NULL, NULL, 1, '2026-02-28 08:13:33.659356+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nus4_qvhrg7xo', '復興國小附設幼兒園', '10000499', 'AY0005', NULL, NULL, '石宗宏', NULL, NULL, 1, '2026-02-28 08:13:33.663678+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nus8_70ue1cdj', '豐榮國小附設幼兒園', '10000500', 'AY0006', NULL, NULL, '詹雅如', NULL, NULL, 1, '2026-02-28 08:13:33.668149+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nusc_8qc6eyfq', '豐年國小附設幼兒園', '10000501', 'AY0007', NULL, NULL, '張淑卿', NULL, NULL, 1, '2026-02-28 08:13:33.672991+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nusl_z8y0wtkb', '新園國小附設幼兒園', '10000503', 'AY0009', NULL, NULL, '陳秋燕', NULL, NULL, 1, '2026-02-28 08:13:33.681609+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nusq_63zy93tg', '豐里國小附設幼兒園', '10000504', 'AY0010', NULL, NULL, '劉宥讌', NULL, NULL, 1, '2026-02-28 08:13:33.685587+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nusv_n8rp0qmw', '知本國小附設幼兒園', '10000505', 'AY0011', NULL, NULL, '范家玲', NULL, NULL, 1, '2026-02-28 08:13:33.689535+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nut0_1bi3caqx', '溫泉國小附設幼兒園', '10000506', 'AY0012', NULL, NULL, '張碧蓉', NULL, NULL, 1, '2026-02-28 08:13:33.695185+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nut4_s0lrzn6n', '建和國小附設幼兒園', '10000507', 'AY0013', NULL, NULL, '詹榮原', NULL, NULL, 1, '2026-02-28 08:13:33.699375+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nut8_7vz6ouhn', '大南國小附設幼兒園', '10000508', 'AY0014', NULL, NULL, '林彩足', NULL, NULL, 1, '2026-02-28 08:13:33.703682+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nutc_7hj7qqzi', '太平國小附設幼兒園', '10000509', 'AY0015', NULL, NULL, '陳原銘', NULL, NULL, 1, '2026-02-28 08:13:33.70819+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nutk_d2klmit9', '豐源國小附設幼兒園', '10000511', 'AY0017', NULL, NULL, '黃正吉', NULL, NULL, 1, '2026-02-28 08:13:33.716325+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuto_d46sipbk', '仁愛國小附設幼兒園', '10000512', 'AY0018', NULL, NULL, '高惠美', NULL, NULL, 1, '2026-02-28 08:13:33.720624+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nutr_s0f26sqt', '公館國小附設幼兒園', '10000513', 'AY0019', NULL, NULL, '顏子矞', NULL, NULL, 1, '2026-02-28 08:13:33.724733+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nutw_f2z12fk7', '卑南國小附設幼兒園', '10000514', 'AY0020', NULL, NULL, '蔡育庭', NULL, NULL, 1, '2026-02-28 08:13:33.729013+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuu0_v9nv3oyu', '南王國小附設幼兒園', '10000515', 'AY0021', NULL, NULL, '李麗君', NULL, NULL, 1, '2026-02-28 08:13:33.733448+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuu4_28xau40f', '初鹿國小附設幼兒園', '10000516', 'AY0022', NULL, NULL, '陳虹穎', NULL, NULL, 1, '2026-02-28 08:13:33.737751+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuud_4a4rbwph', '富岡國小附設幼兒園', '10000518', 'AY0024', NULL, NULL, '謝老師', NULL, NULL, 1, '2026-02-28 08:13:33.747554+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuuh_dnyp687y', '富山國小附設幼兒園', '10000519', 'AY0025', NULL, NULL, '陳薏如', NULL, NULL, 1, '2026-02-28 08:13:33.752146+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuul_cxwdn98r', '興隆國小附設幼兒園', '10000520', 'AY0026', NULL, NULL, '蕭淑丹', NULL, NULL, 1, '2026-02-28 08:13:33.755648+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuup_79lr078z', '寶桑國小附設幼兒園', '10000521', 'AY0028', NULL, NULL, '陳雅琳', NULL, NULL, 1, '2026-02-28 08:13:33.758899+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuut_6icdec5k', '泰源國小附設幼兒園', '10000522', 'AY0029', NULL, NULL, '許珍慈', NULL, NULL, 1, '2026-02-28 08:13:33.762729+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuuy_246xdy37', '北源國小附設幼兒園', '10000523', 'AY0030', NULL, NULL, '林老師', NULL, NULL, 1, '2026-02-28 08:13:33.767957+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuv2_2c3rkrup', '東河國小附設幼兒園', '10000524', 'AY0031', NULL, NULL, '尤美珠', NULL, NULL, 1, '2026-02-28 08:13:33.772788+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuv6_edn3qvx8', '椰油國小附設幼兒園', '10000525', 'AY0032', NULL, NULL, '張主任', NULL, NULL, 1, '2026-02-28 08:13:33.778129+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuvd_4hvvuyx6', '東清國小附設幼兒園', '10000527', 'AY0034', NULL, NULL, '張邑光', NULL, NULL, 1, '2026-02-28 08:13:33.787892+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuvj_hp2kexd9', '關山國小附設幼兒園', '10000528', 'AY0035', NULL, NULL, '關午秘', NULL, NULL, 1, '2026-02-28 08:13:33.793072+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuvn_nqx5mcmv', '月眉國小附設幼兒園', '10000529', 'AY0036', NULL, NULL, '何老師', NULL, NULL, 1, '2026-02-28 08:13:33.800241+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuvr_xa7aahro', '德高國小附設幼兒園', '10000530', 'AY0037', NULL, NULL, '余老師', NULL, NULL, 1, '2026-02-28 08:13:33.804626+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuvv_luqjdbyv', '電光國小附設幼兒園', '10000531', 'AY0038', NULL, NULL, '吳老師', NULL, NULL, 1, '2026-02-28 08:13:33.809135+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuw0_pta4b1li', '鹿野國小附設幼兒園', '10000532', 'AY0039', NULL, NULL, '胡老師', NULL, NULL, 1, '2026-02-28 08:13:33.813641+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuw4_mwwfw4ma', '龍田國小附設幼兒園', '10000533', 'AY0040', NULL, NULL, '陳良侃', NULL, NULL, 1, '2026-02-28 08:13:33.817555+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuw8_dej36p6t', '瑞豐國小附設幼兒園', '10000534', 'AY0041', NULL, NULL, '陳老師', NULL, NULL, 1, '2026-02-28 08:13:33.82194+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuwc_vnpqrxyb', '永安國小附設幼兒園', '10000535', 'AY0042', NULL, NULL, '傅校護', NULL, NULL, 1, '2026-02-28 08:13:33.826339+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuwk_j9ke9gaf', '武陵國小附設幼兒園', '10000537', 'AY0044', NULL, NULL, '陳老師', NULL, NULL, 1, '2026-02-28 08:13:33.834545+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuwo_qml6m0lo', '鸞山國小附設幼兒園', '10000538', 'AY0045', NULL, NULL, '嚴正雍', NULL, NULL, 1, '2026-02-28 08:13:33.838586+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuws_ydajjb0y', '海端國小附設幼兒園', '10000539', 'AY0046', NULL, NULL, '931884', NULL, NULL, 1, '2026-02-28 08:13:33.842238+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuww_agb52c3z', '初來國小附設幼兒園', '10000540', 'AY0047', NULL, NULL, '台東縣台東市新生路268號', NULL, NULL, 1, '2026-02-28 08:13:33.846291+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nux0_nhkztz58', '霧鹿國小附設幼兒園', '10000541', 'AY0048', NULL, NULL, '935070', NULL, NULL, 1, '2026-02-28 08:13:33.85003+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nux9_oz4bvw91', '崁頂國小附設幼兒園', '10000543', 'AY0050', NULL, NULL, '810681', NULL, NULL, 1, '2026-02-28 08:13:33.857682+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuxd_g2g4oo31', '廣原國小附設幼兒園', '10000544', 'AY0051', NULL, NULL, '863402 / qeqesun@yahoo.com.tw', NULL, NULL, 1, '2026-02-28 08:13:33.861265+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuxi_qrzkzjq4', '錦屏國小附設幼兒園', '10000545', 'AY0052', NULL, NULL, '861459 / jako543@msn.com', NULL, NULL, 1, '2026-02-28 08:13:33.865708+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuxm_gbqv9p6h', '加拿國小附設幼兒園', '10000546', 'AY0053', NULL, NULL, '810569', NULL, NULL, 1, '2026-02-28 08:13:33.869693+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuy9_n8s88eze', '測試客戶', '10000000', '0000000', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuyd_u9tc10mz', '綺麗商旅', '10000001', 'A20047', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuyh_y3yifxf7', '松成物流股份有限公司', '10000002', '24891761', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuyl_q3r0dqxn', '家福股份有限公司', '10000003', '28436265', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuyp_o0c3lmqh', '長虹橋海洋餐廳一館', '10000004', 'AC10001', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuyt_vlmnw8xu', '三仙台海洋餐廳二館', '10000005', 'AC10002', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuyx_flw860ge', '田明來餐廳部', '10000006', 'AC10003', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuz2_ys8ebi36', '濱州小吃部', '10000007', 'AC10004', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuz6_gaoljyu1', '虹橋小吃部', '10000008', 'AC10005', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuzb_faecbb7u', '成功-蔡太太', '10000009', 'AC10006', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuzg_rwpfz7lw', '日昇小吃店', '10000010', 'AC10007', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuzk_bvkwlt7i', '成功鎮農會生鮮超市', '10000011', 'AC10008', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuzo_n9a34av5', '台東縣成功鎮農會專營營養午餐事業', '10000012', 'AC10009', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuzt_ok0igoil', '成功鎮農會', '10000013', 'AC10010', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuzx_mwyrt3cs', '烏石鼻餐廳', '10000014', 'AC10011', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv02_qoniybhr', '海洋一館A', '10000015', 'AC10012', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv06_mlm0mmwi', '成功菜市場-陳太太', '10000016', 'AC10013', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0b_qyax8wiy', '成功市場-張太太', '10000017', 'AC10014', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0f_hnbhxvvt', '長濱-豐生店', '10000018', 'AC10015', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0i_77inqfb0', '成功-田媽媽', '10000019', 'AC10016', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0m_g7r6xtyl', '興達商號', '10000020', 'AC10017', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0q_sjzh56sd', '維多利亞餐廳', '10000021', 'AC10018', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0u_qx0fu6ef', '門諾隆昌日照', '10000022', 'AC10019', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv0y_5uxmsv8k', '南竹湖sinasera24', '10000023', 'AC10020', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv13_rj1oph7d', '富杉晴', '10000024', 'ac10021', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv16_8x7laf8t', '廣恆發餐廳', '10000025', 'AC10022', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1a_24o49e6q', '呼拉拉早餐', '10000026', 'AC10023', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1f_8zk2d5fx', '熱帶低氣壓', '10000027', 'AC10024', NULL, NULL, '林小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1i_99pe9wl3', '船頭平價海鮮', '10000028', 'AC10025', NULL, NULL, '周意爭', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1m_44qmw7va', '成功越來家鄉', '10000029', 'AC10026', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1r_x800ysbr', '天成料理', '10000030', 'AC10027', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1v_zxa88olr', '禾樂食堂', '10000031', 'AC10028', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv1z_2c7cab31', '福山滿食堂', '10000032', 'AC10029', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv24_1evor3dz', '東河李小姐', '10000033', 'AC10030', NULL, NULL, '周梅花', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv28_gsw62qe0', '成功美而美', '10000034', 'AC10031', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv2i_0jehgk2a', '空軍第七飛行訓練聯隊', '10000035', 'AC10032', NULL, NULL, '王雨涵', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv2n_po8kjbnf', '林捌酒複合式酒場', '10000036', 'AC10033', NULL, NULL, '戴經理', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv2t_mospr2l3', '阿喜小吃部', '10000037', 'AC10034', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv2x_5aw8od9r', '獨賣美味', '10000038', 'AC10035', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv31_xmvhnjuf', '日暉池上股份有限公司台東分公司', '10000039', 'AC20001', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv36_yvvd2nvw', '鹿野鼎開發股份有限公司', '10000040', 'AC20002', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv3a_kxd26mtm', '綺麗開發企業股份有限公司鹿野分公司', '10000041', 'AC20003', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv3e_8hndn0sn', '脫線農產行', '10000042', 'AC20004', NULL, NULL, '吳慧婷', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv3i_od36vbim', '冠晶自助餐', '10000043', 'AC20005', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv3m_k5y5rhtw', '貳壹國際渡假村股份有限公司永安營業所', '10000044', 'AC20006', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv3q_p5bmuled', '(金暉) 豐泰資產管理有限公司', '10000045', 'AC20007', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv3u_cwutrunk', '(金暉員工) 豐泰資產管理有限公司', '10000046', 'AC20008', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv42_6efks7h9', '初鹿山莊企業社', '10000047', 'AC20009', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv46_x1lpzzb0', '(小熊) 淞巨開發股份有限公司台東分公司', '10000048', 'AC20010', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4c_vctknevb', '果菜合作社', '10000049', 'AC20011', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4g_07745ux9', '林家小館', '10000050', 'AC20012', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4k_klvuw7bb', '瑞源便當店', '10000051', 'AC20013', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4o_o973mkgl', '一粒麥子', '10000052', 'AC20014', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4s_1vcbvkeu', '我家牛肉麵', '10000053', 'AC20015', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4w_avff5a16', '愛幫您火鍋店', '10000054', 'AC20016', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv4z_ug4bqyyt', '布農部落(餐廳)', '10000055', 'AC20017', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv53_865rbhuk', '布農部落(加工廠)', '10000056', 'AC20018', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv57_nt2kv5be', '布農部落(烘培)', '10000057', 'AC20019', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv5b_x5oyqzun', '瑞源古早味', '10000058', 'AC20020', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv5f_i8896j6t', '青青嚐味', '10000059', 'AC20021', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv5j_7xshm33d', '池上燒肉店', '10000060', 'AC20022', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv5o_5q1xb2wg', '池上農改廠', '10000061', 'AC20023', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv5s_h3uc9zbr', '鹿野美秀美食館', '10000062', 'AC20024', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv5w_nw2f6gay', '池上有福館', '10000063', 'AC20025', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv60_di8qhq71', '台大山服-霧鹿', '10000064', 'AC20026', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv64_4b626k3m', '台大山服-利稻', '10000065', 'AC20027', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv69_hnhg3wjj', '台大山服-新武', '10000066', 'AC20028', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv6d_q1ece4ea', '台大山服-電光', '10000067', 'AC20029', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv6i_6lvkw7vp', '池上活力站', '10000068', 'AC20030', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv6n_mvsble2o', '歐家小館', '10000069', 'AC20031', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv6r_ja2wk7vq', '阿忠廚房', '10000070', 'AC20032', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv6w_zj4mb0tk', '鹿台民宿', '10000071', 'AC20033', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuxv_uesk3v1j', '大坡國小附設幼兒園', '10000548', 'AY0055', NULL, NULL, '863415 / her5513@yahoo.com.tw', NULL, NULL, 1, '2026-02-28 08:13:33.878896+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuy1_of22pb56', '紅葉國小附設幼兒園', '10000549', 'AY0056', NULL, NULL, '561307', NULL, NULL, 1, '2026-02-28 08:13:33.883809+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuy5_dnrjud8p', '都蘭附幼', '10000550', 'AY0057', NULL, NULL, '531786 / v580204@yahoo.com.tw', NULL, NULL, 1, '2026-02-28 08:13:33.888168+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv72_72rc1me1', '呷粗飽', '10000072', 'AC20034', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv76_hxb5lu0r', '阿華蔬果店', '10000073', 'AC20035', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv7b_rhkklgao', '東大頂泰珍', '10000074', 'AC20036', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv7f_y6sgjk25', '台泥東立綠能股份有限公司', '10000075', 'AC20037', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv7k_xove9ivx', '成功賣味登', '10000076', 'AC20038', NULL, NULL, '汪小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv7o_hzejemji', '原生植物園', '10000077', 'AC20039', NULL, NULL, '黃先生', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv7s_r8m4200i', '瑞源美而美', '10000078', 'AC20040', NULL, NULL, '陳素惠', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv7x_49jiyn5x', '鹿野瑞隆發展協會', '10000079', 'AC20041', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv81_ujf298be', '潘貴蘭有限公司', '10000080', 'AC20042', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv86_qalwkyz4', '夢海星自助餐', '10000081', 'AC20043', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv8b_kwgsalv9', '大池豆皮店', '10000082', 'AC20044', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv8f_m5jvcewz', '紅記自助餐', '10000083', 'AC20045', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv8k_ypbldate', '正興菜車', '10000084', 'AC20046', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv8p_mpi84omi', '宿祥瑞食堂', '10000085', 'AC20047', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv8x_chyr6tgx', '富野溫泉休閒會館', '10000087', 'AC30002', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv91_bqriiiuf', '知本老爺大酒店股份有限公司', '10000088', 'AC30003', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv95_x051bb9x', '蜜月四季餐旅購有限公司知本金聯世紀酒店分公司', '10000089', 'AC30004', NULL, NULL, '高小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv99_ai8wa94p', '瑪沙魯', '10000090', 'AC30005', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv9d_ptsaigrr', '健康廚房', '10000091', 'AC30006', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv9h_t3olo36l', '聖母農莊聖心', '10000092', 'AC30007', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv9m_8gy70agv', '聖母農莊泰源', '10000093', 'AC30008', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv9y_x8qwjkec', '聖母農莊安朔', '10000094', 'AC30009', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nva3_hpeugjhy', '聖母農莊大溪', '10000095', 'AC30010', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nva7_6k6edkpe', '聖母農莊嘉蘭', '10000096', 'AC30011', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvab_31uo895r', '聖母農莊烘焙', '10000097', 'AC30012', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvag_ns8zio51', '後山傳奇美食館', '10000098', 'AC30013', NULL, NULL, '鄧美雲', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvak_zuztjbrr', '(泓泉) 名泓餐廳', '10000099', 'AC30014', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvap_0oumznah', '(東台) 順龍餐廳', '10000100', 'AC30015', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvat_uobemyg3', '新知本大飯店', '10000101', 'AC30016', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvax_o9yy73s6', '天巴洛有限公司', '10000102', 'AC30017', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvb1_kaviis49', '(中悅) 亞莊酒店企業股份有限公司', '10000103', 'AC30018', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvb5_dd7nroxd', '肯塔基便當', '10000104', 'AC30019', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvb9_ed4sl2xk', '小燕廚房餐館', '10000105', 'AC30020', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvbe_jbvtj48a', '(F商旅) 福利企業股份有限公司知本分公司', '10000106', 'AC30021', NULL, NULL, '黃意琪', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvbi_1zm4uvgw', '(金都) 嘉誠租賃有限公司', '10000107', 'AC30022', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvbm_39aek2l7', '美利商務旅館', '10000108', 'AC30023', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvbq_54snki79', '崎仔頭', '10000109', 'AC30024', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvbv_fbxdn3jd', '臺東縣私立太麻里老人長期照顧中心(養護型)', '10000110', 'AC30025', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvbz_eno2j8sx', '聖母農產組', '10000111', 'AC30026', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvc3_wj3k06r8', '池上便當', '10000112', 'AC30027', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvc7_cy1c6nno', '海天', '10000113', 'AC30028', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvcb_1gjcc0hs', '熊蓋讚', '10000114', 'AC30029', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvcf_7nb3wg7k', '東河廚房', '10000115', 'AC30030', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvck_o13rv6kq', '知本朝陽', '10000116', 'AC30031', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvco_s9anvk80', '太麻里曙光', '10000117', 'AC30032', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvct_i6ulsgne', '猴區廚房', '10000118', 'AC30033', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvcx_qdn03q4r', '立麗大酒店', '10000119', 'AC30034', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvd2_j37m9j41', '黑孩子黑咖啡', '10000120', 'AC30035', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvd6_le27cjut', '田園餐廳', '10000121', 'AC30036', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvdb_nwqmpjp4', '文君美食企業', '10000122', 'AC30037', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvdf_fo2esa9r', '古都', '10000123', 'AC30038', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvdk_pq0nh6ha', '馨香蘭', '10000124', 'AC30039', NULL, NULL, '陳日盛', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvdp_5hhu308x', '東益台越美食', '10000125', 'AC30040', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvdt_5sj25oj6', '大南黃先生', '10000126', 'AC30041', NULL, NULL, '謝小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvdx_inzg60we', '強蒡出擊', '10000127', 'AC30042', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nve2_5ap79af3', '旅行博物館', '10000128', 'AC30043', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nve6_9lgfcbm5', '悟饕豐田店', '10000129', 'AC30044', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nveg_wpqku9k6', '知本520餐廳', '10000130', 'AC30045', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvek_fupnzz4p', '知本鼎皇', '10000131', 'AC30046', NULL, NULL, '邱小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvep_ldrqsn96', '有風居鐵板燒', '10000132', 'AC30047', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvev_fz0kfpq3', '晉銨食坊', '10000133', 'AC30048', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvez_0q9wsiqy', '高野大飯店股份有限公司台東分公司', '10000134', 'AC40001', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvf3_n2ao13t7', '桂田璽悅酒店股份有限公司', '10000135', 'AC40002', NULL, NULL, '何淑華', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvf8_5hjn9gx7', '娜路彎大酒店股份有限公司', '10000136', 'AC40003', NULL, NULL, '陳玉欽', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvfd_0lpw94hs', '松鼎大飯店股份有限公司', '10000137', 'AC40004', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvfi_cmxdobty', '台東縣農會東農餐廳', '10000138', 'AC40005', NULL, NULL, '田小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvfm_sdd3o7nf', '台東縣農會生鮮超市', '10000139', 'AC40006', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvfr_b3q49iic', '台東縣台東地區農會附設農民購物中心', '10000140', 'AC40007', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvfw_tb0ltdw9', '米之香食品有限公司', '10000141', 'AC40008', NULL, NULL, '滕忠益', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvg0_go82cg3y', '後山傳奇-中興店', '10000142', 'AC40009', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvg5_jha5io3i', '台東馬偕紀念醫院', '10000143', 'AC40010', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvga_8peh9dk4', '和風無煙燒肉', '10000144', 'AC40011', NULL, NULL, '沈秋雲', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvgf_mspcv39z', '中豪企業社', '10000145', 'AC40012', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvrq_h46w3mey', '牧心-烘焙', '10000224', 'AC40092', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvgl_7u17sdk9', '台東縣私立利嘉老人長期照顧中心(養護型)', '10000146', 'AC40013', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvgq_8jtqhnhg', '台東縣私立仁和老人養護中心', '10000147', 'AC40014', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvgu_yyc9cc4k', '台東松夏飯店', '10000148', 'AC40015', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvgz_ia17pyic', '歐鄉牛排館', '10000149', 'AC40016', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvh4_9e55pxkh', '湯蒸小吃部', '10000150', 'AC40017', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvh7_3rbm6apw', '來來牛排館', '10000151', 'AC40018', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvhb_zecgh4ky', '千歲火鍋', '10000152', 'AC40019', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvhf_letxuaa3', '固德食坊', '10000153', 'AC40020', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvhk_zzy68x2d', '新北斗火鍋', '10000154', 'AC40021', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvho_7wh1hwpx', '七里坡', '10000155', 'AC40022', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvht_h9tkhc8n', '米豆', '10000156', 'AC40023', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvhx_r0topgzs', '宏田便當', '10000157', 'AC40024', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvi2_ejk32m3f', '168活海鮮餐廳', '10000158', 'AC40025', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvi6_xb3mm9w7', '嗑廳早午餐', '10000159', 'AC40026', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvib_uoc9pk96', '原味羊肉爐', '10000160', 'AC40027', NULL, NULL, '謝彩月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvif_jpwxg53k', '台東牛肉爐', '10000161', 'AC40028', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvik_2tfhijgd', '中華日式海鮮和漢料理食堂', '10000162', 'AC40029', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvip_738bt8bk', '富岡漁港活海鮮餐廳', '10000163', 'AC40030', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nviu_qs9s0ske', '海靖甕仔雞', '10000164', 'AC40031', NULL, NULL, '梁元昌', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nviz_b9e9ju95', '風車教堂', '10000165', 'AC40032', NULL, NULL, '梁元昌', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvj4_virv54sh', '佳味自助餐', '10000166', 'AC40033', NULL, NULL, '梁元昌', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvj8_orj5dlg3', '味軒家常菜', '10000167', 'AC40034', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvjd_ciabnboe', '鮪魚', '10000168', 'AC40035', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvjh_ld3x4gnl', '南豐國際開發股份有限公司', '10000169', 'AC40036', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvjq_izbtiq54', '夏安居', '10000171', 'AC40038', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvju_h3wtsvx3', '小南便當(中華店)', '10000172', 'AC40039', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvjy_zeivetqn', '比莉絲早午餐', '10000173', 'AC40040', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvk9_m5hojgdd', '海草手作健康輕食館', '10000174', 'AC40041', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvke_zjl5qapb', '海中寶有限公司', '10000175', 'AC40042', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvkk_9t0y99xk', '海中寶有限公司總鋪師營業所', '10000176', 'AC40043', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvkp_g47egn4l', '錢櫃小吃部', '10000177', 'AC40044', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvku_z4npjrkt', '呷飯皇帝大', '10000178', 'AC40045', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvkz_d9rwqsj8', '御軒小火鍋', '10000179', 'AC40046', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvl4_5rd17vte', '艾薇塔', '10000180', 'AC40047', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvl9_ovzqupx7', '東成技能訓練所消費合作社', '10000181', 'AC40048', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvlf_dmkm2tk7', '台東監獄合作社', '10000182', 'AC40049', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvll_yp8jh4rz', '神仙滷味', '10000183', 'AC40050', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvlq_ycv7u9n3', '早安美芝城(豐榮路)', '10000184', 'AC40051', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvlw_15i69z4u', '東方大鎮美芝城', '10000185', 'AC40052', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvm1_2j42yveo', '早安美芝城(正氣路)', '10000186', 'AC40053', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvm6_vnocowma', '吉川屋', '10000187', 'AC40054', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvmb_u4twk36i', '小老闆泡菜', '10000188', 'AC40055', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvmg_vgcf5v4e', '幸福公煮', '10000189', 'AC40056', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvml_ie1unbwc', '上野時尚會館', '10000190', 'AC40057', NULL, NULL, '吳小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvmp_7jyk0hcc', '新池便當', '10000191', 'AC40058', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvjm_gqiw2khe', '凱旋星光酒店股份有限公司', '10000192', 'AC40059', NULL, NULL, NULL, NULL, NULL, 1, '2026-02-28 08:13:32.26275+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvn1_d47emavi', '企鵝商店', '10000193', 'AC40060', NULL, NULL, '楊教練', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvn7_r86upcwo', '妙屋美食城', '10000194', 'AC40061', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvnc_tairheig', '菲哥餐廳', '10000195', 'AC40062', NULL, NULL, '陳小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvnh_qupiswdp', '綠島阿川', '10000196', 'AC40063', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvnn_pgnqvn7g', '其他客戶', '10000197', 'AC40064', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvns_89d4pdqa', '五花馬水餃館', '10000198', 'AC40065', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvnz_r06dirc1', '阿賓羊肉爐', '10000199', 'AC40066', NULL, NULL, '邱金珠', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvo5_hotck1lc', '禾昌火鍋', '10000200', 'AC40067', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvoa_f5fv94zu', '水鹿餐廳', '10000201', 'AC40068', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvog_5i5e2v8g', '綺麗(員工餐)', '10000202', 'AC40069', NULL, NULL, '林峰伸', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvoy_75y5qzyd', '綺麗園區', '10000203', 'AC40070', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvp4_nyk7dojf', '秘亞', '10000204', 'AC40071', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvp8_s063cec1', '台東縣新生國民小學', '10000205', 'AC40072', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvpd_laouhku1', '緣龍', '10000206', 'AC40073', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvpi_0uuzksg4', '承泰國際投資股份有限公司台東分公司', '10000207', 'AC40074', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvpm_gr4b6dll', '大園日本料理', '10000208', 'AC40075', NULL, NULL, '黃治鈞', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvpr_jryiadgd', '滷底撈', '10000209', 'AC40076', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvpw_dnyr8nzh', '鴻瑞實業有限公司', '10000210', 'AC40077', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvq0_6wwmt0nf', '雅風築雲', '10000211', 'AC40078', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvq5_3as42xbp', '西螺阿欽', '10000212', 'AC40079', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvq8_hvwavf5a', '西螺阿城', '10000213', 'AC40080', NULL, NULL, '吳秋月', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvqd_oq4ao2k7', '林記牛肉麵', '10000214', 'AC40081', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvqh_g5i9qdp3', '延平鄉公所', '10000215', 'AC40082', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvql_vyxhso2b', '綺麗紅珊瑚', '10000216', 'AC40083', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvqq_26bhlsr8', '米巴奈美食', '10000217', 'AC40085', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvqw_jwi5esdx', '台灣牛', '10000218', 'AC40086', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvr1_2fii8jff', '健康會館', '10000219', 'AC40087', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvr6_86vdr3o7', '翠安儂早餐部', '10000220', 'AC40088', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvrb_6smkeddy', '聖母醫院廚房', '10000221', 'AC40089', NULL, NULL, '潘毅鴻', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvrg_usxcb8xf', '牧心麵包-餐廳', '10000222', 'AC40090', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvrl_cmbpn1fo', '牧心麵包-廚房', '10000223', 'AC40091', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvrv_uj51n03o', '天地人日式創意料理', '10000225', 'AC40093', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvs0_o92yf2zk', '大三壯狀排骨飯', '10000226', 'AC40094', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvs6_771ap0zp', '好味韓式', '10000227', 'AC40095', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvsb_iqxp6yxq', '旅人驛站鐵花大飯店股份有限公司', '10000228', 'AC40096', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvsg_1ajwzwxs', '拿手菜餐坊', '10000229', 'AC40097', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvsl_cafn38ua', '雯雞起舞', '10000230', 'AC40098', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvsq_tcf946mo', '蝦醬小吃店', '10000231', 'AC40099', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvsv_cojdwpmq', '三媽臭臭鍋', '10000232', 'AC40100', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvt0_53l7futd', '台東專科-楊同學', '10000233', 'AC40101', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvt6_ftbrw3du', '台東川普牛排', '10000234', 'AC40102', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvta_mycdhe40', '儀品屋', '10000235', 'AC40103', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvtf_0ypxinzy', '肉食動物', '10000236', 'AC40104', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvtt_ptft79wt', '出出', '10000237', 'AC40105', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvtz_sde1hlqx', '烤大爺', '10000238', 'AC40106', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvu4_g4nyl2q1', '餓零穀堡', '10000239', 'AC40107', NULL, NULL, '0980605749', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvu9_20gzh4er', '時光車站', '10000240', 'AC40108', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvud_s5z8wiie', '馨琳', '10000241', 'AC40109', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvuj_a77a27f1', '魔法素廚房', '10000242', 'AC40110', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvuo_491pfrke', '王小姐', '10000243', 'AC40111', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvut_4l918sl5', '顏小姐', '10000244', 'AC40112', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvuy_mvz1y4jn', '佳慧', '10000245', 'AC40113', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvv2_wixqgygv', '美濃板條', '10000246', 'AC40114', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvv6_o6ca6siu', '原住民會館', '10000247', 'AC40115', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvva_611mjhck', '台東文旅(營業部)', '10000248', 'AC40116', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvvf_o9w9fn55', '文化健康站', '10000249', 'AC40117', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvvj_f6tga68k', '有石有食', '10000250', 'AC40119', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvvm_n17rd5qo', '土虱小吃店', '10000251', 'AC40120', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvvq_uctkmkku', '深黑義法', '10000252', 'AC40121', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvvu_wkpmaui2', '萬富商號', '10000253', 'AC40122', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvvy_hip7rtlr', '興隆92號', '10000254', 'AC40123', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvw4_mpv3c98u', '都蘭休閒渡假開發股份有限公司', '10000255', 'AC40124', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvwc_exmptah4', '百佬燴', '10000256', 'AC40125', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvwg_4wxxmh3j', '黃金海岸', '10000257', 'AC40126', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvwk_g65ver77', '輝哥', '10000258', 'AC40127', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvwp_ifq95nac', '一品泡菜', '10000259', 'AC40128', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvwt_h3twheoj', '就愛醬拌', '10000260', 'AC40129', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvwx_s6oufvoh', '雙口呂輕食坊', '10000261', 'AC40130', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvx1_zn07nz7i', '川普牛肉麵', '10000262', 'AC40131', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvx5_m1aobedz', '初鹿牧場', '10000263', 'AC40132', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvx9_yy06zcyp', '富岡銀谷', '10000264', 'AC40133', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvxe_vngwp6vi', '保安隊', '10000265', 'AC40134', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvxj_0wahtq3w', '竹芳越南小吃店', '10000266', 'AC40135', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvxo_3i71nvzc', '中正路越南美食', '10000267', 'AC40136', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvxs_nd38e0at', '更生路越南美食', '10000268', 'AC40137', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvxw_580uczug', '西貢河粉', '10000269', 'AC40138', NULL, NULL, '田昊婷', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvy0_bxinenxc', '如意坊', '10000270', 'AC40139', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvy5_tmlz809d', '周師傅便當', '10000271', 'AC40140', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvy9_07yd4t7o', '柏林老人養護中心', '10000272', 'AC40141', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvyd_5esrc1sg', '韓森館', '10000273', 'AC40142', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvyh_t7zip7cu', '四海遊龍', '10000274', 'AC40143', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvym_n0ahe7jj', '王媽媽便當', '10000275', 'AC40144', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvyq_8w7840ox', '怡彤', '10000276', 'AC40145', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvyv_xqwn5jca', '清粥小菜', '10000277', 'AC40146', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvz0_uf1yvngb', '大地體育用品', '10000278', 'AC40147', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvz5_fszlka0g', '禾風新棧', '10000279', 'AC40148', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvz9_yio3ineo', '孩子書屋', '10000280', 'AC40149', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvzd_rtndznjz', '大南書屋', '10000281', 'AC40150', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvzj_oga5gf2i', '第一銀行', '10000282', 'AC40151', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvzn_pndmavfe', '荷蘭先生', '10000283', 'AC40152', NULL, NULL, '王美桂', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvzr_v0io030t', '小虎', '10000284', 'AC40153', NULL, NULL, '王美桂', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvzv_3fe4gejs', '喜樂旅店', '10000285', 'AC40154', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nvzz_4b3y3k3w', '東遊季溫泉', '10000286', 'AC40155', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw03_m3rai54o', '全國排骨(光明店)', '10000287', 'AC40156', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw07_pta7lmsq', '綺麗幼兒園', '10000288', 'AC40157', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw0c_qlz30m36', '泰源書屋', '10000289', 'AC40158', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw0g_hyirj2pc', '富麗灣景觀民宿', '10000290', 'AC40159', NULL, NULL, '廖庭儀', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw0o_qsnfrm7m', '全國排骨(更生店)', '10000292', 'AC40161', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw0s_6szuo59v', '林秀碧', '10000293', 'AC40162', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw0w_qxmacwhd', '有一間', '10000294', 'AC40163', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw10_oa41xxut', '晨間廚房-中興店', '10000295', 'ac40164', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw14_pii5j7mo', '旅人二館', '10000296', 'AC40165', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw18_phbjmzp6', '竹筒屋', '10000297', 'AC40166', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw1c_pylb41e6', '延福廚房', '10000298', 'AC40167', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw1g_hgiced2s', '行動餐車', '10000299', 'AC40168', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw1l_d9rgoi0h', '關山有福館', '10000300', 'AC40169', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw1q_if5av74c', '榕樹下米苔目舖', '10000301', 'AC40170', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw1u_wvk9othf', '香雅鹹素雞', '10000302', 'AC40171', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw1y_ariua9aq', '菩提樹', '10000303', 'AC40172', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw22_xadokav2', '丸呈蔬果行', '10000304', 'AC40173', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw26_zm5g12s3', '王郝的店', '10000305', 'AC40439', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw2a_wbo4k6eq', '花媽鍋物', '10000306', 'AC40440', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw2e_2nv2qfge', '吳小姐', '10000307', 'AC40441', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw2i_9vaih8ka', '臺鐵員工餐廳', '10000308', 'AC40442', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw2m_sq1zfd7o', '康橋漢堡', '10000309', 'AC40443', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw2r_p6jdcv5q', '黃記蔥油餅', '10000310', 'AC40444', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw2v_tlxwuq73', '桶一滷味', '10000311', 'AC40445', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw30_msqg8s9q', '富裕商旅', '10000312', 'AC40446', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw34_424wp2c5', '零九八一', '10000313', 'AC40447', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw37_go0xtxtr', '小旬湯', '10000314', 'AC40448', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw3b_93ius8g4', '專情島', '10000315', 'AC40449', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw3f_h6hqbsjd', '濟州韓式', '10000316', 'AC40450', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw3j_tkyr9sp5', '行雲會館', '10000317', 'AC40451', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw3n_uagbn98r', '初貳伍', '10000318', 'AC40452', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw3s_y16fgz2e', '祥瑞烘培坊', '10000319', 'AC40453', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw3w_p68ylv1a', '廣東路水煎包', '10000320', 'AC40454', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw40_hq2144am', '九格浪', '10000321', 'AC40455', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw44_ox18x1uc', '東區職訓', '10000322', 'AC40480', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw48_j7ujclt9', '林校長', '10000323', 'AC40481', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw4b_2cv3ha8x', '龍田國小(面山學校)', '10000324', 'AC40482', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw4f_vnha3sd5', '光輝食雞', '10000325', 'AC40484', NULL, NULL, '紀沛涵', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw4j_1qsrld0r', '小玉餐館', '10000326', 'AC40485', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw4n_dgvahir6', '品鑫快炒', '10000327', 'AC40486', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw4s_fmmd8vx9', '一心養護', '10000328', 'AC40487', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw4w_j42vxggm', '永富商號', '10000329', 'AC40488', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw50_txrhuf0c', '泰安放山雞', '10000330', 'AC40489', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw54_3ue3y4j5', '泰陽光', '10000331', 'AC40490', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw58_7f6f4zns', '泰安小吃部', '10000332', 'AC40491', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw5d_8u8cdqzr', '雙饗丼', '10000333', 'AC40492', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw5h_kwnxprhn', '饗像空間', '10000334', 'AC40493', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw5l_qjbtg4xv', '晉欣營造', '10000335', 'AC40494', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw5q_1tedmi1f', '東指部砲兵營', '10000336', 'AC40495', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw5u_x6p2lcxf', '紀沛涵', '10000337', 'AC40496', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw5y_r4rweskt', '東指部機步二營', '10000338', 'AC40497', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw62_rhf08nh6', '太平聯合餐廳', '10000339', 'AC40498', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw65_nlogj1hm', '蔬果箱-500元', '10000340', 'AC40499', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw69_jb4ho3lm', '蔬果箱-300元', '10000341', 'AC40500', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw6d_i8yzunx4', '工業區服務中心', '10000342', 'AC40501', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw6h_lc6s092r', '許先生', '10000343', 'AC40502', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw6l_i8fmui1s', '太平本部連', '10000344', 'AC40503', NULL, NULL, '莊淑娟', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw6q_3vgmv6r9', '東指部機步一營', '10000345', 'AC40504', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw6v_yqc6qnjh', '王顧問', '10000346', 'AC40505', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw6z_9mkjq2sw', '秘食-私廚', '10000347', 'AC40506', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw75_7l2ag842', '雲棧部落', '10000348', 'AC40507', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7a_5q5nm5l5', '天使麻辣-中華店', '10000349', 'AC40508', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7e_ujsrreio', '天使麻辣-東大店', '10000350', 'AC40509', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7j_5v0q816x', '詠糧實業有限公司', '10000351', 'AC40510', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7n_hi3jqqzl', '大埔鐵板燒', '10000352', 'AC40511', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7r_kvjmwmzy', '馬蘭-町', '10000353', 'AC40512', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7v_1bjg2eq5', '舞奇雞', '10000354', 'AC40513', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw7z_sgr56hr0', '巨森(長沙店)', '10000355', 'AC40514', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw84_i6gvb214', '台東趣淘漫旅', '10000356', 'AC40515', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw89_qtf2yzyz', '荳荳阿稼', '10000357', 'AC40516', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw8c_ey74d6cb', '壹加壹速食店', '10000358', 'AC40518', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw8h_ersxwg3b', '群方飲食店', '10000359', 'AC40519', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw8m_5hwn442v', '永和豆漿', '10000360', 'AC40520', NULL, NULL, '韓文靈', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw8q_7gict2ps', '澎湖小吃部', '10000361', 'AC40521', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw8v_yswsroic', '溢香便當', '10000362', 'AC40522', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw8y_aqmu9k9z', '台東Stay bar-咖啡廳', '10000363', 'AC40523', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw93_war1p7tv', '72度C', '10000364', 'AC40524', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw97_zmvmvwsx', '風巢民宿', '10000365', 'AC40525', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw9b_xspiogqt', '伯德漢堡', '10000366', 'AC40526', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw9f_7b91uhgg', '米客便當', '10000367', 'AC40527', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw9j_ks6r45oa', '寶桑三代目', '10000368', 'AC40600', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw9n_kv0s12sk', '正氣路美而美', '10000369', 'AC40601', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw9s_a1dsw82x', '如意行館', '10000370', 'AC40602', NULL, NULL, '王秀琴', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwa1_nopselfo', '陳郁薇-網購合作', '10000372', 'AC40604', NULL, NULL, '謝昆峰', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwa5_oso1v62v', '農莊服務中心', '10000373', 'AC40605', NULL, NULL, '謝昆峰', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwa9_wxml95vf', '璞草行館', '10000374', 'AC40606', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwad_o9jhh0yy', '台東副供站', '10000375', 'AC40607', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwah_qy745rgg', '花蓮副供站', '10000376', 'AC40608', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwam_0nr1c3g1', '台東體中', '10000377', 'AC40609', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwat_fd4j350f', '撒里嵐', '10000378', 'AC40610', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwax_cd0zk2uw', '九龍廣東粥', '10000379', 'AC40611', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwb2_o86j0d38', '蘋果商務旅店', '10000380', 'AC40612', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwb9_orf82s70', '台東專科-鍾智丞', '10000381', 'AC4101-7', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwbd_69tzceam', '龍港海鮮餐廳', '10000382', 'AH00001', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwbh_4p46clnl', '台東龍港餐飲有限公司', '10000383', 'AH00002', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwbl_0iugk4iq', '松揚中央廚房', '10000384', 'AH00003', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwbs_0plfn7g3', '大潤發', '10000385', 'AH00004', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw9x_8avt9nkj', '私廚便當', '10000566', 'AC40603', NULL, NULL, '陳靜敏', NULL, NULL, 1, '2026-02-28 08:13:33.968482+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwc0_7i7di9nv', '法務部矯正署臺東監獄', '10000387', 'AJ00002', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwck_jz7net9s', '法務部矯正署泰源技能訓練所', '10000391', 'AJ00006', NULL, NULL, '林怡君', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwbx_inv2zehd', '法務部矯正署台東戒治所', '10000392', 'AJ00007', NULL, NULL, '林裕閔', NULL, NULL, 1, '2026-02-28 08:13:33.194187+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwcu_q5rtrbxh', '法務部矯正署台東監獄', '10000393', 'AJ00008', NULL, NULL, '顏燕琴', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwc5_0bp28j4b', '法務部矯正署綠島監獄', '10000394', 'AJ00009', NULL, NULL, '黃校護', NULL, NULL, 1, '2026-02-28 08:13:33.20375+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwc9_lwj6k0dz', '法務部矯正署岩灣技能訓練所', '10000395', 'AJ00010', NULL, NULL, '李慧敏', NULL, NULL, 1, '2026-02-28 08:13:33.207889+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwcd_iepnizaz', '法務部矯正署東成技能訓練所', '10000396', 'AJ00011', NULL, NULL, '張碧娟', NULL, NULL, 1, '2026-02-28 08:13:33.212477+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwdd_3hipidwx', '純青學堂光明班', '10000397', 'AM0001', NULL, NULL, '紀沛涵', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwdi_b8xhhe8p', '純青學堂卑南班', '10000398', 'AM0002', NULL, NULL, '郭嘉雯', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwdo_idr49qeu', '純青學堂東海班', '10000399', 'AM0003', NULL, NULL, '南佳青', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwdt_pjmojksu', '純青學堂桂林班', '10000400', 'AM0004', NULL, NULL, '吳美玉', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwdx_abzrg9wf', '純青學堂寶桑班', '10000401', 'AM0005', NULL, NULL, '陳美齡', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwe2_7uik4b0u', '純青學堂太平班', '10000402', 'AM0006', NULL, NULL, '王唯菱', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nufa_resck9j9', '新生國中', '10000403', 'AS1001', NULL, NULL, '李正如', NULL, NULL, 1, '2026-02-28 08:13:33.246778+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nufg_498ly4ho', '東海國中', '10000404', 'AS1002', NULL, NULL, '石宗宏', NULL, NULL, 1, '2026-02-28 08:13:33.251565+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nug4_uehqs2pu', '新園國小', '10000409', 'AS1010', NULL, NULL, '林婷玉', NULL, NULL, 1, '2026-02-28 08:13:33.275484+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nugm_n9tqz9bb', '大南國小', '10000413', 'AS1015', NULL, NULL, '詹榮原', NULL, NULL, 1, '2026-02-28 08:13:33.295367+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuhv_rqera6h6', '岩灣國小', '10000423', 'AS2003', NULL, NULL, '顏子矞', NULL, NULL, 1, '2026-02-28 08:13:33.337743+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuj3_opsjt9b1', '東河國小', '10000432', 'AS2012', NULL, NULL, '陳登財', NULL, NULL, 1, '2026-02-28 08:13:33.373603+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nukb_r3kv1ckm', '南王國小', '10000440', 'AS2021', NULL, NULL, '陳錦珠', NULL, NULL, 1, '2026-02-28 08:13:33.4195+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwjo_9r9xbe38', '桃源國中', '10000446', 'AS3002', NULL, NULL, '蘇桂暖', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuly_ir6e8wib', '鹿野國小', '10000450', 'AS3006', NULL, NULL, '陳老師', NULL, NULL, 1, '2026-02-28 08:13:33.459424+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61numv_lto5yrwd', '關山國小', '10000458', 'AS3014', NULL, NULL, '何老師', NULL, NULL, 1, '2026-02-28 08:13:33.495685+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nunz_j9qmnv5w', '錦屏國小', '10000467', 'AS3023', NULL, NULL, '陳素貞', NULL, NULL, 1, '2026-02-28 08:13:33.535065+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwn3_dbx4ci83', '美和國小', '10000475', 'AS3031', NULL, NULL, '陳小姐', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nupj_9lmuloi3', '關山工商', '10000478', 'AS4003', NULL, NULL, '811526 / ddt637@yahoo.com.tw', NULL, NULL, 1, '2026-02-28 08:13:33.579953+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuq6_48k1grof', '復興國小', '10000481', 'AS5003', NULL, NULL, '348852 / t733554@yahoo.com.tw', NULL, NULL, 1, '2026-02-28 08:13:33.593126+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuqz_8ku9wsog', '宗和食品有限公司', '10000488', 'AS5010', NULL, NULL, '李慧敏', NULL, NULL, 1, '2026-02-28 08:13:33.621333+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwox_kthe941q', '大道食品有限公司', '10000491', 'AS6002', NULL, NULL, '高雅林', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwp0_dh3nsx7i', '成功分院', '10000492', 'AS6003', NULL, NULL, '郭嘉雯', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwp8_763n2gmv', '大王國小', '10000494', 'AS6006', NULL, NULL, '吳美玉', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nurr_evjcadhl', '台東縣延平鄉立托兒所', '10000496', 'AY0002', NULL, NULL, '陳美齡', NULL, NULL, 1, '2026-02-28 08:13:33.652312+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nush_k05l67q9', '豐田國小附設幼兒園', '10000502', 'AY0008', NULL, NULL, '陳麗芳', NULL, NULL, 1, '2026-02-28 08:13:33.677147+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nutg_jmqo62c6', '利嘉國小附設幼兒園', '10000510', 'AY0016', NULL, NULL, '施秉杰', NULL, NULL, 1, '2026-02-28 08:13:33.712169+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuu9_83tjqs7s', '賓朗國小附設幼兒園', '10000517', 'AY0023', NULL, NULL, '李老師', NULL, NULL, 1, '2026-02-28 08:13:33.742265+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuva_3f880gm8', '朗島國小附設幼兒園', '10000526', 'AY0033', NULL, NULL, '陳錦珠', NULL, NULL, 1, '2026-02-28 08:13:33.783749+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuwg_4ju4ep9i', '瑞源國小附設幼兒園', '10000536', 'AY0043', NULL, NULL, '何校護', NULL, NULL, 1, '2026-02-28 08:13:33.830577+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nux4_0ccw1u1i', '利稻國小附設幼兒園', '10000542', 'AY0049', NULL, NULL, '935070 / pankof1000@gmail.com', NULL, NULL, 1, '2026-02-28 08:13:33.853934+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nuxr_q4tjpqco', '福原國小附設幼兒園', '10000547', 'AY0054', NULL, NULL, '863721', NULL, NULL, 1, '2026-02-28 08:13:33.874314+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwwd_wn8bh4jz', '鑫美環保清潔行', '10000553', 'BN0028', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwwi_0iq57svr', '如記食品有限公司', '10000554', 'BN0029', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwwm_9982teae', '慶鐘佳味食品股份有限公司', '10000555', '85886091', NULL, NULL, '陳惠鵬', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwwr_i0psecyo', '財團法人伊甸社會福利基金會', '10000556', '89039422', NULL, NULL, '蔡芳綺', NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwx0_i6wzcyoc', '臺東縣海端鄉利稻發展協會', '10000557', '09550413', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwx4_nvt14vao', '永福路弘爺早餐', '10000558', 'AC40626', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwxa_mhnjmyb0', '財源豐蔬菜行', '10000559', 'AC20051', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwxf_50oxc8o7', '進達商行', '10000560', 'AC20052', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwxk_enmzmotq', '關山家常菜', '10000561', 'AC20055', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwxp_4h0uu77e', '成功弘爺早餐店', '10000562', 'AC10036', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwxu_q69z43qr', '九樑豬肉舖', '10000563', 'AC20054', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwxz_c1qdzjvz', '阿源小吃部', '10000564', 'AC20048', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwy3_zk4c04e7', '307自助餐', '10000565', 'AC20050', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nw0k_aj16ckq4', '李素蘭水餃', '10000567', 'AC40160', NULL, NULL, NULL, NULL, NULL, 1, '2026-02-28 08:13:33.973924+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwyo_1kfba7dc', '養鍋', '10000569', 'AC40620', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwyt_m1h9qc87', '客家自助餐', '10000570', 'AC40613', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwyz_df04krqw', '泰品燒烤便當', '10000571', 'AC40489', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwz4_t0ehn5vd', '南王美亦美', '10000572', 'AC40625', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwz9_m3bicmuw', '美滿客棧', '10000573', 'AC40614', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwze_zbs84u7g', '小豬很忙(成功店)', '10000574', 'AC40621', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwzj_l2jbkvl8', '三仙國小', '10000575', 'AC10009-01', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwzn_j15tuflj', '成功國小', '10000576', 'AC10009-02', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwzs_qqcv8n3c', '新港國中', '10000577', 'AC10009-03', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwzy_s06qald5', '三民國小', '10000578', 'AC10009-04', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx04_fypyajbp', '和平國小', '10000579', 'AC10009-05', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx09_ivvzg7ur', '信義國小', '10000580', 'AC10009-06', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx0d_a5yzatup', '忠孝國小', '10000581', 'AC10009-07', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx0j_jhc4tfxd', '博愛國小', '10000582', 'AC10009-08', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx0n_bphvfdfs', '寧埔國小', '10000583', 'AC10009-09', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx0r_i11fsgff', '竹湖國小', '10000584', 'AC10009-10', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nww4_ts6ezdap', '101文具天堂', '10000552', 'BG0020', NULL, NULL, NULL, NULL, NULL, 0, '2026-03-02 12:07:27.258997+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx0v_xrthtpik', '長濱國小', '10000585', 'AC10009-11', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx0z_t9q1drmi', '三間國小', '10000586', 'AC10009-12', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx13_xcge3lia', '樟原國小', '10000587', 'AC10009-13', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx17_xbyeddkq', '長濱國中', '10000588', 'AC10009-14', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx1b_d6vk0i16', '珍好食堂', '10000589', 'AC20057', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx1f_ml32itap', '禾珍商行', '10000590', 'AC20058', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx1j_7pz4a7wr', '富富廚房', '10000591', 'AC40628', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx1n_k7pnjdo9', '大漠漢堡', '10000592', 'AC40629', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx1s_bqjwu9om', '友愛商旅', '10000593', 'AC40640', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx1w_8xpa0oav', '東聚', '10000594', 'AC40639', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx20_psog1qac', '興昌快餐店', '10000595', 'AC10041', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx24_w6ww3ng9', '珍亮自助餐', '10000596', 'AC20063', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx28_omsjnblf', '玉里悟饕', '10000597', 'AC20059', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx2d_ppgirmen', '宏富水產有限公司', '10000598', 'AC20060', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx2h_ycler1nc', '延平巷弄站', '10000599', 'AC20062', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx2l_9lua4q0w', '機關車庫', '10000600', 'AC60644', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx2p_vao7kq0c', '北町丼飯屋', '10000601', 'AC40643', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx2t_4qi5rzu6', '福錄壽', '10000602', 'AC10037', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx2x_i65jakkg', '218無骨鹹酥雞', '10000603', 'AC10038', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx32_e0fioz50', '成功海銀行', '10000604', 'AC10039', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx36_lqan7440', '成功金剛好', '10000605', 'AC10040', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx3b_msk6b2ta', '巴森營造', '10000606', 'AC30051', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nv8u_plklv4xp', '高野大飯店股份有限公司', '10000607', 'AC30001', NULL, NULL, NULL, NULL, NULL, 1, '2026-02-28 08:13:34.156387+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx3k_hwx3r4h6', '知本開喜小吃部', '10000608', 'AC30053', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx3p_8c5dx0kc', '知本巴拉冠', '10000609', 'AC30052', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx3u_mcwwc3xs', '綠島老宅', '10000610', 'AC40269', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nwyj_xzsbpogi', '綠島悟饕', '10000611', 'AC40619', NULL, NULL, NULL, NULL, NULL, 1, '2026-02-28 08:13:34.17437+00', NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx43_cf54lki0', '大漠漢堡綠島店', '10000612', 'AC40629', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx47_igdazczz', '綠島黃小姐', '10000613', 'AC40636', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx4b_76r1elez', '綠島樸嶼', '10000614', 'AC40638', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx4g_5u5ipgf4', '蛋裡INEGG', '10000615', 'AC40641', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx4l_ktjic66f', '綠島夏天家', '10000616', 'AC40642', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx4q_7whvk7c0', '院子有樹咖啡店', '10000617', 'AC40644', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx4u_im4ye2ga', '綠島夏一間', '10000618', 'AC60645', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx4z_35k7btp2', '仟子蓮', '10000619', 'AC60648', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx54_d0zui7ja', '誠實米糕', '10000620', 'AC40635', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx59_5qek6maw', '台東越鄉-越式小館', '10000621', 'AC40633', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx5e_ra7o9rpi', '厚道商行', '10000622', 'AC30050', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx5i_ecarefay', '縣府', '10000623', 'AC40174', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx5o_2difjdpm', '和平文健站', '10000624', 'AC20061', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx5t_3z8cnci8', '大松米苔目', '10000625', 'AC40623', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx5z_0cmz32dm', '魚刺人', '10000626', 'AC60646', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx64_tziab0n1', '溫度釀製所', '10000627', 'AC40630', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx69_uberquwu', '鮮旺鍋燒麵', '10000628', 'AC60649', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx6c_zqreoxyl', '慧子的店', '10000629', 'AC40637', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx6i_hyz2kg9x', '二二二精品咖啡', '10000630', 'AC60650', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm61nx6p_9faki9j6', '翡秝大飯店', '10000631', 'AC60651', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL);
INSERT INTO public.customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, updated_at, route_line) VALUES ('cust_mm8pfq2r_mhhkq99i', 'TEST3', NULL, NULL, NULL, 'C48764d2a8908f997740d3d1408588d4a', NULL, NULL, NULL, 1, NULL, NULL);


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o97t_54i5wxoq', '紅皮小洋芋', '10100004', '110100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o97w_686vrjyd', '甜菜根', '10100005', '110100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o97z_jixv0dkr', '牛蒡', '10100006', '110100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o982_xw3xxqj8', '紫地瓜', '10100009', '110100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o984_xqub31nb', '豆薯', '10100010', '110100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o987_uv46pd26', '山藥', '10100011', '110100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o989_tzk9syjf', '紫山藥', '10100012', '110100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o98c_o262fkbl', '日本山藥', '10100013', '110100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o98e_0wiwfq0i', '蘆筍(中把)', '10100016', '110100016', '把', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o98i_lemce6vu', '馬鈴薯(進口)', '10100018', '110100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o98l_r5krdg4x', '蓮藕', '10100019', '110100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o98n_5gcoba4i', '荸薺', '10100020', '110100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o98z_bc4n47h0', '菱角', '10100021', '110100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o992_qcvld0pc', '百合根', '10100022', '110100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o995_gf7a3niy', '紫洋蔥', '10100025', '110100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o998_x3sv4aj9', '半天筍', '10100028', '110100028', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99a_lv3m4pin', '桂竹筍', '10100029', '110100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99c_25ke2w9y', '碧玉筍', '10100032', '110100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99f_2umvq4hx', '蘆筍進口', '10100036', '110100036', '把', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99h_nexxi1gg', '蘆筍(去皮)', '10100037', '110100037', '把', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99k_8e9ry2ey', '蘆筍(大把)', '10100038', '110100038', '把', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99m_15kgvme0', '蘆筍(小把)', '10100039', '110100039', '把', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99q_sefgpk5a', '黃櫛瓜', '10100044', '110100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99t_dquiuwqh', '綠櫛瓜', '10100045', '110100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99v_w4y075k6', '栗子南瓜', '10100047', '110100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o99y_rdlmjbat', '山苦瓜', '10100049', '110100049', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9a0_v22ib64z', '豆苗', '10100057', '110100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9a3_n9bsowl3', '豆苗(盒)', '10100058', '110100058', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9a5_hzgd7has', '甜豆', '10100059', '110100059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9a8_1136zj2p', '甜豆(加工)', '10100060', '110100060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9aa_696q87xg', '荷蘭豆(進口)', '10100064', '110100064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ac_1kxhn3ly', '青花菜(進口)', '10100065', '110100065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ad_y788aczn', '佛手瓜', '10100067', '110100067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9af_hhtx58jb', '玉米筍(盒)', '10100068', '110100068', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ai_xximtpti', '帶殼玉米筍', '10100069', '110100069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ak_xgu2f12o', '青花筍', '10100075', '110100075', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9am_deoztk2f', '金針花', '10100076', '110100076', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ap_lxntpbm8', '金針花(進口)', '10100077', '110100077', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9at_pimo9y17', '石蓮花', '10100078', '110100078', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9av_s2j0hzqn', '蘭花', '10100080', '110100080', '束', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ax_evugvsha', '櫻桃蘿蔔', '10100081', '110100081', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9b0_f2qwpbw3', '青苦瓜', '10100082', '110100082', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9b2_dszebvwq', '綠辣椒', '10100083', '110100083', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9b4_qdqzm5sa', '珍珠洋蔥', '10100084', '110100084', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9b6_w0ygk053', '高麗菜-進口', '10100085', '110100085', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9b9_gswn8vff', '芹菜管', '10100086', '110100086', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bb_pp1x7c22', '栗子', '10100087', '110100087', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bf_msqw6qq4', '小芋頭', '10100088', '110100088', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bi_1o7h14wd', '迷你紅蘿蔔', '10100089', '110100089', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bl_4p6g00ld', '栗子地瓜', '10100090', '110100090', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bo_ioxtl9ya', '東昇南瓜', '10100091', '110100091', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bu_6l5kyqv6', '貝貝南瓜', '10100092', '110100092', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9bx_uzg7dleb', '三色椒', '10100093', '110100093', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9c1_aubywr26', '帶殼玉米筍(包)', '10100094', '110100094', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9c4_hr4vtvg3', '白皮小洋芋', '10100095', '110100095', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9c7_a8edsopd', '紅蘿蔔絲', '10100100', '110100100', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ca_92k010g6', '白蘿蔔絲', '10100101', '110100101', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9cd_5qsj3lk9', '紫高麗菜', '10200003', '110200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ch_7nvv54xu', '大白菜(進口)', '10200007', '110200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ck_eslqtdc1', '皇宮菜', '10200010', '110200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9cm_7vnahu8t', '西芹', '10200014', '110200014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9co_3hg6138y', '水芹菜', '10200015', '110200015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9cr_y7sjpmum', '山芹菜', '10200016', '110200016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ct_r9onsfxo', '生菜葉', '10200020', '110200020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9cv_0vr2njxj', '美生菜', '10200021', '110200021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9cx_glm6ow46', '蘿蔓', '10200022', '110200022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9d0_m743vfvs', '紫包心', '10200023', '110200023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9d2_iet6j4j3', '紅捲鬚', '10200024', '110200024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9d4_ixd8p0co', '綠捲鬚', '10200025', '110200025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9d6_719sggrk', '皇帝豆', '10200026', '110200026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9d8_pp4w3kf0', '綠橡木生菜', '10200027', '110200027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9da_492l9qe0', '芥菜仁', '10200028', '110200028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9de_jumf0hrp', '娃娃菜', '10200031', '110200031', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9dh_osva46ma', '山茼蒿', '10200034', '110200034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9dk_9n5fzm8v', '紅莧菜', '10200036', '110200036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9dm_5khyfu3k', '野莧菜', '10200037', '110200037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9dp_z67krwx7', '紅鳳菜', '10200041', '110200041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9dr_we8lkkb1', '龍鬚菜', '10200042', '110200042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9du_7fmyg15w', '水蓮', '10200043', '110200043', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9e2_mk7niv3m', '過貓', '10200044', '110200044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9e5_4weizvkn', '黑甜仔菜', '10200046', '110200046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9e7_0eicwrah', '川七', '10200047', '110200047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ea_7sy0olxg', '米菜', '10200048', '110200048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ec_jgqmua5e', '高麗菜苗', '10200049', '110200049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ef_1bzqhr6v', '食用花', '10200050', '110200050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9eh_tknghtlr', '紅酸模菜(盒)', '10200051', '110200051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ej_oz1hmyd6', '咸豐草', '10200052', '110200052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9em_lxdrgfjf', '珊瑚草', '10200053', '110200053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9eo_ypon2kuk', '月桃葉', '10200054', '110200054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9eq_ljkk9jjo', '時令青菜(暫存用)', '10200055', '110200055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9es_qo233wbo', '芝麻葉', '10200056', '110200056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9eu_gi849deb', '翡翠娃娃菜', '10200057', '110200057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ex_vp12wpg6', '山蘇', '10200058', '110200058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ez_vugrii44', '羅勒(盒)', '10200059', '110200059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9f2_h31yqky6', '香菜(盒)', '10200060', '110200060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9f4_pmcegadp', '塔菜(盒)', '10200061', '110200061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9f6_qbyncr7b', '紅莧(盒)', '10200062', '110200062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9f9_3wfsi1a1', '芝麻菜(盒)', '10200063', '110200063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fb_o1ae0w4w', '紫高麗苗(盒)', '10200064', '110200064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fd_zqixtaom', '歐芹(盒)', '10200065', '110200065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ff_o1f90gpl', '山蘿蔔(盒)', '10200066', '110200066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fi_42amp7q2', '牛血菜(盒)', '10200067', '110200067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fk_c9u5f7j2', '雪豆苗(盒)', '10200068', '110200068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fl_eavh1iv7', '水蓮(大包)', '10200070', '110200070', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fo_xaxwi0y3', '紅蔥頭', '10300002', '110300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fq_kpfo1lk0', '紅蔥頭(去皮)', '10300003', '110300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ft_kvfsdsh3', '紅蔥頭(絞碎)', '10300004', '110300004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fv_63unzxqh', '蒜苗', '10300013', '110300013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9fx_sdao5fct', '青龍', '10300025', '110300025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9g0_imhwrjzc', '巴西里', '10300028', '110300028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9g2_9wsvr9b2', '香茅', '10300029', '110300029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9g4_xaobz3ts', '茴香', '10300030', '110300030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9g6_39ul0g4w', '迷迭香', '10300031', '110300031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9g9_fr4maocs', '紫蘇葉', '10300032', '110300032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gb_iio12d32', '蒔蘿', '10300033', '110300033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gd_buun9sct', '薄荷葉', '10300034', '110300034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gf_crg8pba9', '黑蒜頭', '10300035', '110300035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gi_asck41fn', '薑泥', '10300036', '110300036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gk_kmyrimy9', '檸檬葉', '10300037', '110300037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gn_pv1ztz4y', '蔥白', '10300039', '110300039', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gq_ewkrsfnv', '蔥絲', '10300040', '110300040', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gw_v6v1x8e7', '洋菇', '10400001', '110400001', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9gz_dtliiq3n', '草菇', '10400002', '110400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9h1_se1zuyim', '木耳', '10400003', '110400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9h4_t3zvd4r5', '川耳', '10400004', '110400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9h6_pvgjh8ya', '白木耳(盒)', '10400005', '110400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9h9_nf8hcsd2', '生香菇', '10400006', '110400006', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hb_ca66l8h2', '生香菇(去蒂)', '10400007', '110400007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9he_njwmh5ds', '生香菇(大)', '10400008', '110400008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hg_xcuojj88', '生香菇(中)', '10400009', '110400009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hi_fd9bjlyu', '生香菇(小)', '10400010', '110400010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hk_6gyqgu3l', '生香菇(柳)', '10400011', '110400011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hn_86l1wbnb', '金針菇-5KG/包', '10400012', '110400012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hp_pmy4mjmq', '金針菇(真空)', '10400013', '110400013', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hs_7cag2bi5', '鮑魚菇', '10400014', '110400014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hv_3smvn5km', '秀珍菇', '10400015', '110400015', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9hz_9pcrqurn', '杏鮑菇', '10400016', '110400016', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9i2_1f29cn9h', '杏鮑菇頭', '10400017', '110400017', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9i5_qyzrlbs1', '白靈菇', '10400018', '110400018', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9i9_zebpku1d', '雪白菇', '10400019', '110400019', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ic_kdbpvzyz', '鴻喜菇', '10400020', '110400020', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ie_cs3o6kzs', '珊瑚菇', '10400021', '110400021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ih_bpq8dezq', '柳松菇', '10400022', '110400022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ik_yfl6509j', '猴頭菇', '10400023', '110400023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9im_vv8zmdce', '黑珍珠菇', '10400024', '110400024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ip_qawkupvc', '銀芽', '10400027', '110400027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ir_xuaqr4n0', '苜蓿芽(盒)', '10400029', '110400029', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9it_zyji0bp7', '黑美人菇', '10400032', '110400032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9iw_34o2plby', '舞菇', '10400034', '110400034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9iz_yrcz68im', '松本茸', '10400035', '110400035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9j1_tqcklk7o', '酸菜', '10500001', '110500001', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9j4_61w8bd57', '酸菜心', '10500002', '110500002', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9j6_th51qc5g', '酸白菜', '10500003', '110500003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9j9_bjg9eqbm', '雪裡紅', '10500004', '110500004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9jc_zsnrkh79', '醃酸瓜', '10500005', '110500005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9je_dfclx0um', '冷筍', '10500006', '110500006', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9jh_efz40nsl', '酸江豆', '10500007', '110500007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9jk_gmfxf7yp', '劍筍片', '10500008', '110500008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9jn_io080875', '桶筍', '10500009', '110500009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9jq_x88nehj6', '筍干', '10500010', '110500010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9js_xsh1vfyk', '脆筍片', '10500011', '110500011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ju_kjr310bk', '筍絲T3', '10500012', '110500012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9jx_6lpkbsgh', '筍絲T6', '10500013', '110500013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9k0_xgrcht57', '熟花生', '10500014', '110500014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9k2_7d6wfj99', '熟花生(去殼)', '10500015', '110500015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9k4_rfay6vy5', '筍絲T2', '10500016', '110500016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9k7_b7pigg3c', '西瓜綿', '10500017', '110500017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9k9_666k3mjv', '甘蔗筍', '10500018', '110500018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kc_5p0rceno', '有機皺葉白菜', '10600001', '110600001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ke_zudf67qe', '有機空心菜', '10600002', '110600002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kh_2oc9dm1x', '有機小松菜', '10600003', '110600003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kj_n3qw1n83', '有機莧菜', '10600004', '110600004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kl_z5g5ej64', '有機黑葉白菜', '10600005', '110600005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kn_oih8j98a', '有機山菠菜', '10600006', '110600006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kq_aqwdyp9e', '有機青江菜', '10600007', '110600007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ks_ngedc3mo', '有機青松菜', '10600008', '110600008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kv_2l9sj6es', '有機綠莧菜', '10600009', '110600009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9kx_x4s2slxj', '有機青油菜', '10600010', '110600010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9l0_b33qq35z', '有機甜心菜', '10600011', '110600011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9l3_u62p8jc4', '有機地瓜葉', '10600012', '110600012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9l5_72c0hzwh', '有機小白菜', '10600013', '110600013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9l8_wlz1fktu', '有機鵝白菜', '10600014', '110600014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9la_kyqg2fod', '有機味美菜', '10600015', '110600015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ld_5sorpt6h', '有機小芥菜', '10600016', '110600016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lf_dpyt0o3a', '有機荷葉白菜', '10600017', '110600017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lh_hnup32sv', '有機菠菜', '10600018', '110600018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lj_3u6tln58', '有機芥藍菜', '10600019', '110600019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lm_pkbqfj7q', '有機山茼萵', '10600020', '110600020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lp_xmwkv5q5', '有機奶白菜', '10600021', '110600021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ls_net2r44o', '有機油菜', '10600022', '110600022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lu_mm7cxezu', '有機四季白菜', '10600023', '110600023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lx_gm5m121x', '有機廣島菜', '10600024', '110600024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9lz_7rkc0vfm', '有機美松菜', '10600025', '110600025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9m2_kec1cyj7', '玉女小蕃茄', '20100002', '120100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9m4_j8kkl63j', '蘋果(大)', '20100003', '120100003', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9m6_uocj0cso', '蘋果(小)', '20100004', '120100004', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9m9_7z8tr9qd', '青蘋果', '20100005', '120100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mc_jvkgur16', '黃檸檬', '20100014', '120100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mf_0oh4bcae', '奇異果', '20100016', '120100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mh_2fe59ibl', '黃金奇異果', '20100017', '120100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mk_aj4p2666', '金桔', '20100018', '120100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mm_bk0wipej', '香吉士', '20100019', '120100019', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mp_s5egjunf', '柚子', '20100026', '120100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ms_yt83rde5', '柚子(禮盒)', '20100027', '120100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mu_h2v3map3', '葡萄柚', '20100028', '120100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mx_mm77kq6i', '李子', '20100031', '120100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9mz_u1hd1je5', '蓮霧', '20100035', '120100035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9n1_h96zfg9p', '芒果', '20100036', '120100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9n3_u3nnb1e7', '哈密瓜', '20100038', '120100038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9n5_lxm8g6sj', '蜜世界', '20100039', '120100039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9n7_gjov6jzg', '美濃瓜', '20100040', '120100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9n9_0qrhwl0j', '柿子', '20100043', '120100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9nb_0fqsay76', '櫻桃', '20100044', '120100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ne_u6sejxhf', '水蜜桃', '20100045', '120100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ng_0sxz2j85', '酪梨', '20100048', '120100048', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9nj_k94hu23z', '雪梨', '20100049', '120100049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9nm_ohx3dfbt', '西洋梨', '20100050', '120100050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9no_2vdtco9s', '水梨', '20100051', '120100051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9nq_eb7yoruy', '水梨(禮盒)', '20100052', '120100052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9nt_oxvcldv7', '釋迦', '20100054', '120100054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9nw_bgpjz1x7', '棗子', '20100055', '120100055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ny_jn5njzxh', '草莓', '20100056', '120100056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9o1_bhykluka', '百香果', '20100057', '120100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9o4_zxuihej6', '甘蔗(削皮)', '20100059', '120100059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9o7_q7qli7av', '檸檬汁950cc', '20100060', '120100060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9o9_0yaf6a2t', '棗李', '20100061', '120100061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ob_r936kz90', '甘露李', '20100062', '120100062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9oe_284ih82r', '紅肉李', '20100063', '120100063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9og_3qton5g9', '素瓜子肉燥', '20600052', '120600052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9oj_sny2zzrp', '肉片-CAS', '30100001', '130100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9om_afbgqgl0', '肉丁-CAS', '30100002', '130100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9or_irvyrnfd', '肉絲-CAS', '30100003', '130100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ou_h04bp2rf', '絞肉-CAS', '30100004', '130100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ox_dc4e4w4x', '中排肉-CAS', '30100005', '130100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9oz_649rscxj', '大骨-CAS', '30100006', '130100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9p2_f5e28jav', '肉片(溫)', '30100007', '130100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9p4_3vsft1bf', '肉丁(溫)', '30100008', '130100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9p7_a4x726yd', '肉絲(溫)', '30100009', '130100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9pa_cxrlfpgp', '絞肉(溫)', '30100010', '130100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9pe_wzdnmi0w', '排骨(溫)', '30100011', '130100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ph_exxup0y3', '大骨(溫)', '30100012', '130100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9pk_o7f90plk', '帶骨肉排CAS(立大)70', '30100013', '130100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9po_hbgk9z8p', '里肌肉排-70', '30100014', '130100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9pr_jjk6acsq', '松阪肉', '30100015', '130100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9pu_15hnfxw7', '萬巒豬腳', '30100016', '130100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9px_6iqugw98', '豬腳', '30100017', '130100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9q0_cm0qr62a', '豬腳丁', '30100018', '130100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9q4_o7hn1x97', '蹄膀', '30100019', '130100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9q7_20zkoon4', '蹄筋', '30100020', '130100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qb_yxb1wtn7', '五花肉排', '30100021', '130100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qf_oavvps2a', '五花肉條(溫)', '30100022', '130100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qi_30i2920b', '鹹豬肉條', '30100023', '130100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ql_25kdq1pw', '梅花肉', '30100024', '130100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qo_30kh3yjy', '胛心肉', '30100025', '130100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qr_ukblq3pr', '烤肉片', '30100026', '130100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qt_4k08x1wh', '燒肉片', '30100027', '130100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qw_xrynewjn', '豬頭皮', '30100028', '130100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9qz_5smu5the', '豬心', '30100029', '130100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9r2_331joage', '豬皮', '30100030', '130100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9r4_c8nwm5k0', '豬耳朵', '30100031', '130100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9r8_826eghbm', '小腸', '30100032', '130100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rb_gz7n8sp5', '大腸', '30100033', '130100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rd_6rndmz27', '里肌肉片', '30100034', '130100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rg_dixgzo6k', '五花肉片(溫)', '30100035', '130100035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rj_w5kosu0d', '中排骨-CAS', '30100036', '130100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rm_q61s66cx', '腳庫', '30100037', '130100037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ro_i5g2645w', '五花肉絲(溫)', '30100038', '130100038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rr_m5uk62gb', '梅花肉絲(溫)', '30100039', '130100039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ru_gfs4pe1i', '里肌肉(溫)', '30100040', '130100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9rx_n39z5to7', '肉羹(溫)', '30100041', '130100041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9s0_z230gf20', '腰子', '30100042', '130100042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9s3_b8ir442a', '蔬菜肉排', '30100043', '130100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9s5_dexqwm6v', '腰內肉', '30100044', '130100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9s8_lq8hq2mz', '臘肉', '30100045', '130100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sb_nbd677bz', '子排', '30100046', '130100046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sd_j2zj4s8n', '帶骨肉排CAS(強匠)70', '30100047', '130100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sg_ondutqiy', '肥腸', '30100048', '130100048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9si_rt9u6ao1', '大里肌', '30100049', '130100049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sk_8l3h30ah', '海鴻豬腳', '30100055', '130100055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sn_w2079i62', '肉丁CAS(津谷)', '30100056', '130100056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sp_idwhzsfd', '肉片CAS(津谷)', '30100057', '130100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ss_sm7n81tv', '肉絲CAS(津谷)', '30100058', '130100058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sv_tip93lbn', '絞肉CAS(復進)', '30100059', '130100059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sx_7te6ygg1', '龍骨CAS(保憶)', '30100060', '130100060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9sz_5p2zxrcr', '大骨CAS(津谷)', '30100061', '130100061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9t2_ojuda075', '肝連肉', '30100062', '130100062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9t4_64txxjcn', '中排骨-CAS(津谷)', '30100063', '130100063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9t7_6nxr98xm', '雞胸丁-CAS', '30200001', '130200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9t9_vnqkd7h1', '清雞胸肉', '30200002', '130200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tc_sjlj2mjg', '棒腿丁CAS(冠源)', '30200003', '130200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tf_04867n8u', '三節翅CAS-W6', '30200004', '130200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9th_k7o1i96e', '雞排CAS-TS4', '30200005', '130200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tk_jzfht9na', '雞腿CAS-D5', '30200006', '130200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tn_ctikvqzp', '雞腿D6', '30200007', '130200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tr_4gm6xox4', '骨腿T8', '30200008', '130200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tt_3qahrrgg', '骨腿T6', '30200009', '130200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9tw_pramzrcn', '骨腿丁', '30200010', '130200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9u0_xieevrzp', '紐澳良雞腿排', '30200011', '130200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9u3_2zsl83z2', '土雞整隻', '30200012', '130200012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9u6_yt1kf355', '五香里肌肉片', '30200013', '130200013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9u8_pjr1alks', '板腱牛排', '303000004', '130300000', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ub_93kx8iv6', '牛肉片', '30300001', '130300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ud_w13dizzm', '牛肉絲', '30300002', '130300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ug_8wgkjq6o', '牛肉丁', '30300003', '130300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ui_wsnh8gbp', '牛絞肉', '30300004', '130300004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ul_0wtrjo46', '牛腩', '30300005', '130300005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9un_l6443kkr', '牛腱', '30300006', '130300006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9uq_8fnyt6dg', '牛肚', '30300007', '130300007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ut_wnhfhqji', '牛小排(300g)', '30300008', '130300008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9uv_166pu4o1', '牛肋條', '30300009', '130300009', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ux_bgouzapt', '羊小排', '30400001', '130400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9uz_zmxb7tbj', '羊肉片', '30400002', '130400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9v1_7htaiikw', '羊肉丁', '30400003', '130400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9v3_j91b2xlh', '羊肉排', '30400004', '130400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9v5_hzfsj4kh', '羊肉絲', '30400005', '130400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9v7_9lvnx712', '鵝肉', '30500001', '130500001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9v9_8jjjckuk', '鴨丁(溫)', '30600001', '130600001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vb_3bjmfgn3', '雞腳', '31200001', '131200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ve_8ly8vqx6', '雞心', '31200002', '131200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vh_7hc74hv7', '雞腱', '31200003', '131200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vj_gu8w2gfx', '雞胗', '31200004', '131200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vl_loylistc', '檸檬雞柳條', '31200005', '131200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vo_ijt5fxsq', '蔥油雞', '31200006', '131200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vq_mtaf8yf7', '雞骨', '31200007', '131200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vs_7i15bush', '鴨血', '31300001', '131300001', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vv_qc3jwavd', '挪威鯖魚一夜干', NULL, '140100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vx_xsa7z46b', '旗魚片', '40100002', '140100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9vz_wlxxbiov', '龍虎斑魚丁', '40100003', '140100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9w2_ov3zc7ua', '鯛魚片', '40100004', '140100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9w4_qao5hfh6', '虱目魚排', '40100005', '140100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9w7_t20o8tyw', '鯖魚55片', '40100006', '140100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9w9_fs1wqqgu', '鯖魚65片', '40100007', '140100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wb_83pqpp3k', '魚丁', '40100008', '140100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9we_1kvfdus2', '吻仔魚', '40100009', '140100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wg_rm8vwtgk', '柳葉魚-生', '40100010', '140100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wi_uzvdpsdr', '柳葉魚-黃', '40100011', '140100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wk_tfwyv6po', '秋刀魚', '40100012', '140100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wm_umnd515e', '肉魚', '40100013', '140100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wo_j4u46xb4', '金線魚', '40100014', '140100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wr_fhcec3eg', '吳郭魚', '40100015', '140100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wu_gabwkmyz', '紅目鰱', '40100016', '140100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wx_63ngwwri', '白口魚', '40100017', '140100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9wz_cklwsiuu', '白帶魚', '40100018', '140100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9x2_fwx1gaoj', '鮭魚燒', '40100019', '140100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9x4_yulc1qov', '鯊魚切片', '40100020', '140100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9x6_cybazu5e', '鱸魚', '40100021', '140100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9x8_83yd9tky', '烏魚', '40100022', '140100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xb_ie3rzxza', '虱目魚', '40100023', '140100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xd_scgyxwm0', '虱目魚肚', '40100024', '140100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xf_45vryee3', '虱目魚片', '40100025', '140100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xi_cv2vepzm', '烏魚子', '40100026', '140100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xl_kzjrkmmz', '蒲燒鰻', '40100027', '140100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xn_lw72lgsh', '吳郭魚(飯店)', '40100028', '140100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xq_ns6mu8dl', '多利魚', '40100029', '140100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xt_96x5enfs', '挪威鯖魚片(真空)', '40100030', '140100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xw_819w7dhs', '魚下巴', '40100031', '140100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9xy_al1vu28f', '鮑魚', '40100032', '140100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9y1_1v2cxipg', '香魚(母)', '40100033', '140100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9y3_19i6ksbp', '魚皮', '40100034', '140100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9y6_a6x7svfi', '生魚片', '40100035', '140100035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9y9_58oma851', '虱目魚頭', '40100036', '140100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9yb_1kokj8a0', '國宴魚蝴蝶切', '40100037', '140100037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ye_6dihhlj5', '魚肉', '40100038', '140100038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9yh_dxpvfi9f', '市肉', '40100039', '140100039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9yj_8xoqb2zp', '赤筆魚', '40100040', '140100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ym_3y5887nh', '鯖魚35片', '40100041', '140100041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9yp_zypqak3h', '翡翠', '40100043', '140100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9ys_tql8cl48', '鰈魚片', '40100044', '140100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9yu_uypulpv4', '香魚(公)', '40100045', '140100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9yx_5ert4x3f', '香魚(公)14P', '40100046', '140100046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9z0_qrx9ncgw', '鯖魚45片', '40100047', '140100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9z2_hgxpig0s', '鬼頭刀', '40100048', '140100048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9z5_laf0yl0s', '魚骨肉', '40100049', '140100049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9z7_ikqw0h8m', '魚皮肉', '40100050', '140100050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9za_y0gu7sea', '蛤蠣(小)', '40200001', '140200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zc_6fmfn02t', '蜆仔', '40200002', '140200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zf_rmeg5wai', '蚵仔', '40200003', '140200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zh_m4evmq74', '扇貝', '40200004', '140200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zk_nnaa4x5t', '干貝', NULL, '140200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zm_of96cn8r', '蛤蠣(中)', '40200006', '140200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zp_8b2azz3x', '蛤蠣(大)', '40200007', '140200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zr_u9ggxx3i', '干貝唇', '40200008', '140200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zu_twod1wvg', '干貝-真空包', '40200009', '140200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zx_2ley5tlg', '生蠔', '40200010', '140200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61o9zz_qkqhzexe', '蝦仁', '40300001', '140300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa02_rgip8dnn', '白蝦', '40300002', '140300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa05_g8l1wwss', '草蝦', '40300003', '140300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa08_buodv4wg', '紅蟳', '40300005', '140300005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0b_51f3e0ud', '熟白蝦', '40300006', '140300006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0e_v7x9ejmf', '蟹味棒', '40300007', '140300007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0g_z7jwf9fc', '沙蟹身', '40300008', '140300008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0j_aoj5d9gh', '蟹管肉', '40300009', '140300009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0m_6um7zkx1', '蟳味棒', '40300010', '140300010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0p_7q95etja', '龍蝦', '40300011', '140300011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0r_vwsvjfk3', '明蝦', '40300012', '140300012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0u_5g9b2e2v', '溪蝦', '40300013', '140300013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0x_nmo1j2ne', '拉長蝦5L', '40300014', '140300014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa0z_cy59cdg6', '冷凍白蝦(盒)', '40300015', '140300015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa12_cuwad73x', '海帶片', '40400001', '140400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa15_s3o34w7f', '海帶絲', '40400002', '140400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa17_dq6trocp', '海帶根', '40400003', '140400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1b_01i9bzci', '海帶結', '40400004', '140400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1d_g8zriklo', '海茸', '40400005', '140400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1g_ublp5l2n', '海菜', '40400006', '140400006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1j_sy1t9ziy', '海參', '40400007', '140400007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1m_tkjwfysj', '刺參', '40400008', '140400008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1o_6ycirz89', '魷魚翅(水發魷魚)', '40500001', '140500001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1r_q4dy28e7', '花枝刻花', '40500002', '140500002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1t_jgck4e7n', '花枝', '40500003', '140500003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa1w_c3ulrux3', '小卷-鹹', '40500004', '140500004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa20_txfix2i6', '小卷-淡', '40500005', '140500005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa22_no0iuht6', '小管', '40500006', '140500006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa24_nrv67klm', '小章魚', '40500007', '140500007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa26_coev81a8', '魷魚圈', '40500008', '140500008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa29_xt5rk5wr', '海香菇', '40500009', '140500009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2c_7aa8wpvv', '海蜇皮', '40500010', '140500010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2f_apvdr2e1', '海瓜子', '40500011', '140500011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2i_5dnbbw42', '肉包(龍鳳)', '50100001', '150100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2l_z4e6wzl9', '高麗菜包(龍鳳)', '50100002', '150100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2o_xkov0kjf', '玉兔包', NULL, '150100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2q_b1kj0chj', '紅豆包(龍鳳)', '50100004', '150100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2t_kl58lc2x', '芋泥包(龍鳳)', '50100005', '150100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2v_n9s4pc6v', '芝麻包(龍鳳)', '50100006', '150100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa2y_6y2zk3sf', '豆沙包(龍鳳)', '50100007', '150100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa31_bxb0a1pe', '奶皇包(龍鳳)', '50100008', '150100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa34_5hmqqhu7', '叉燒包(龍鳳)', '50100009', '150100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa38_m34bu3yx', '鮮奶饅頭(龍鳳)', '50100010', '150100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3b_l6y726bz', '銀絲卷(晶鈺)', '50100011', '150100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3f_9o6uf6a4', '牛奶饅頭(晶鈺)', '50100012', '150100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3h_9h2d244h', '蔥抓餅(晶鈺)', '50100013', '150100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3l_ml5sr1g6', '全麥饅頭70g(七)', '50100014', '150100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3o_t782u7oq', '山東饅頭90g', '50100015', '150100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3r_149nxypm', '雜糧饅頭', '50100016', '150100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3u_ski5e9ta', '珍珠豆沙包(晶鈺)', '50100017', '150100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa3x_aqaaqui2', '珍珠奶皇包(晶鈺)', '50100018', '150100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa40_90xqxc2u', '黑糖饅頭', '50100021', '150100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa42_nuelhgx0', '焦糖布丁饅頭', '50100022', '150100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa45_aticaaxu', '全麥小饅頭40g(七)', '50100023', '150100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa49_l4zqus1z', '無糖小饅頭(龍鳳)', '50100024', '150100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4c_3tdm5sez', '鮮奶小饅頭(龍鳳)', '50100026', '150100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4h_ggjpjcq7', '草莓小饅頭', '50100027', '150100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4l_6wp0zz0q', '雞蛋小饅頭', '50100028', '150100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4o_w46gcfow', '黑糖小饅頭(龍鳳)', '50100029', '150100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4s_etnwf2j1', '金絲卷(龍鳳)', '50100030', '150100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4v_0z3ttpi7', '銀絲卷(龍鳳)', '50100031', '150100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa4z_wp8pb9xe', '迷小銀絲卷', '50100032', '150100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa53_lgag6696', '蔥花卷', '50100033', '150100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa57_gr7dbrus', '香蔥金絲卷', '50100034', '150100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5a_thu6rnf3', '香蔥銀絲卷', '50100035', '150100035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5d_1wg86udn', '香蔥花卷(賈)', '50100036', '150100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5g_s2pklsu8', '黑糖金絲捲', '50100039', '150100039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5j_bsvwse52', '刈包(龍鳳)', '50100040', '150100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5m_f5rmd2lu', '巧克力牛奶雙色饅頭', '50100042', '150100042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5p_nnze2wkq', '雙色饅頭', '50100043', '150100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5s_s8xran61', '山東全麥饅頭120g', '50100044', '150100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa5y_0mk9nr3d', '喜兔包(晶鈺)', '50100045', '150100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa61_7cje2t59', '肉包(晶鈺)', '50100046', '150100046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa64_n760ngjt', '奶皇包(晶鈺)', '50100047', '150100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa67_6ithx02y', '芋泥包(晶鈺)', '50100048', '150100048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6a_so6nmi5t', '芝麻包(晶鈺)', '50100049', '150100049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6c_mal0nlsu', '豆沙包(晶鈺)', '50100050', '150100050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6j_nukyet97', '巧克力銀絲卷', '50100051', '150100051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6n_cqvbffvb', '花生芝麻卷', '50100052', '150100052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6p_7nbm78qe', '炸蝦', '50100053', '150100053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6s_facq2fm4', '龍港芋頭包', NULL, '150100054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6u_r1ipcb67', '龍港芝麻包', NULL, '150100055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa6y_18tb18co', '龍港鮮肉包', NULL, '150100056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa70_uhulyzaf', '龍港豆沙包', NULL, '150100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa72_eur67ltt', '鍋貼(佳味)', '50200001', '150200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa75_3oio1ftp', '餛飩', '50200002', '150200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa77_lhpwjv0z', '餛飩(飯店)', '50200003', '150200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7a_lz4lu6c2', '鍋貼(龍鳳)', '50200004', '150200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7c_cv5godes', '蘿蔔糕50g', '50300001', '150300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7f_zh0cac4i', '蘿蔔糕100g', '50300002', '150300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7h_rtxw1k2e', '高麗菜卷', '50300003', '150300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7j_a8xere5v', '紫米珍珠丸', '50300004', '150300004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7m_1w48gwq6', '糯米珍珠丸', '50300005', '150300005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7o_th2zj41a', '鮮肉熟水餃', '50300006', '150300006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7q_pqdg6tjk', '韭菜水餃', '50300007', '150300007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7s_6wegrhjy', '餡餅(龍鳳)', '50300008', '150300008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7v_qzbh8xqw', '肉粽', '50300009', '150300009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa7x_lzxtexlh', '小籠湯包(佳味)', '50300010', '150300010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa80_r2e29t2q', '小煎包', '50300011', '150300011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa83_d18iaodo', '水煎包(龍鳳)', '50300012', '150300012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa85_xaf7utv5', '地瓜芝麻球', '50300013', '150300013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa88_v3d0hk1c', '芝麻球', '50300014', '150300014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8a_atfsr28j', '地瓜球', '50300015', '150300015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8c_bk5xvfmn', '芋頭丸', '50300016', '150300016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8f_h7jbvfyk', '芋頭卷', '50300017', '150300017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8h_ys38e0qw', '蛋黃芋丸', '50300018', '150300018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8j_udxlwerd', '蛋黃麻糬芋丸(飯店)', '50300019', '150300019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8m_bujgkz0z', '芝麻糬丸(飯店)', '50300020', '150300020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8o_fxs43xzz', '芋仔餅', '50300021', '150300021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8q_6w09jbbv', '春捲', '50300022', '150300022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8t_oxxf45ss', '湯圓', '50300023', '150300023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8v_uabdtb3x', '小湯圓', '50300024', '150300024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa8y_s2pmb8mu', '小湯圓0.6KG', '50300025', '150300025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa90_s16tj20x', '白色小湯圓', '50300026', '150300026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa94_usqqgae5', '芝麻湯圓', '50300027', '150300027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa96_dichejk1', '花生湯圓', '50300028', '150300028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa99_frlxg5ya', '鮮肉湯圓', '50300029', '150300029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9b_27ucqf2i', '地瓜圓', '50300030', '150300030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9e_ndatq1jy', '芋圓', '50300031', '150300031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9h_o0cmg59h', '龍鳳腿', '50300032', '150300032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9k_07dlsmtr', '燒賣', '50300033', '150300033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9n_b2hrva2z', '蔥抓餅', '50300034', '150300034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9q_2mkcwh3o', '肉圓', '50300035', '150300035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9t_8om81dbg', '山藥卷', '50300036', '150300036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9w_5tfqqtwl', '馬蹄條', '50300037', '150300037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oa9z_tdjz0eq7', '水晶餃', '50300038', '150300038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaa3_jo3cbu47', '油條', '50300039', '150300039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaa5_f5pgbake', '韭菜盒子', '50300040', '150300040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaa8_piiwwg8k', '筒仔米糕', '50300041', '150300041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaac_ogkffuzj', '燒餅', '50300042', '150300042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaaf_jc4l9gi1', '芋丸(餐廳用)', '50300043', '150300043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaah_gny889z2', '水果麻糬', '50300044', '150300044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaak_pugyybjg', '芋頭蘿蔔糕', '50300045', '150300045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaam_0h56m0kk', '蘿絲冰捲', '50300046', '150300046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaap_0ermj0o7', '馬拉糕(龍)', '50300047', '150300047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaas_0oriehzo', '三角薯餅', '50300048', '150300048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaav_ccwfl6ge', '蔥煎包', '50300049', '150300049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaay_0frf5khy', '起司薯餅', '50300050', '150300050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oab0_5b7dhfk2', '可樂餅', '50300051', '150300051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oab3_m00t9mze', '玉米奶酥餅', '50300052', '150300052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oab5_4e9ggtwz', '薯條', '50300053', '150300053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oab8_f0c9m3ku', '波浪薯條', '50300054', '150300054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaba_p27jca4n', '洋蔥圈', '50300055', '150300055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabc_k7sfp6de', '小熱狗棒', '50300056', '150300056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabf_icohvuxe', '酥皮', '50300057', '150300057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabi_3gknb5fp', '起司球', '50300058', '150300058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabk_a44b0mj5', '起司丸', '50300059', '150300059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabn_h8g65ols', '糯米腸', '50300060', '150300060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabq_o31wigz6', '微笑薯餅', '50300061', '150300061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabt_mmhdn2ox', '起司絲', '50300062', '150300062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabw_v4qekq56', '帶皮馬鈴薯', '50300063', '150300063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oabz_ukr7c1pk', '曼波薯塊', '50300064', '150300064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oac2_2t0yw4vv', '起司棒', '50300065', '150300065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oac5_mygcj893', '起士粉', '503000661', '150300066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oac8_w91k73i8', '帶皮薯條', '50300067', '150300067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaca_qap67qhs', '紅豆黃金捲', '50300068', '150300068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oacd_ubpca5z8', '水煎包(香根)', '50300069', '150300069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oacf_v5fortos', '鹹麻糬', '50300070', '150300070', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaci_9eld6sem', '香豆球', '50300071', '150300071', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oacl_yjok7j0o', '椰香山藥捲', '50300072', '150300072', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaco_1202vxmc', '餡餅(佳味)', '50300073', '150300073', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oacr_on4lt9fg', '小蛋糕', '50400001', '150400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oact_tue0k97g', '蜂蜜蛋糕', '50400002', '150400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oacw_gbwvkxek', '杯子蛋糕', '50400003', '150400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oacy_ws7zmcyn', '清蛋糕8吋', '50400004', '150400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oad1_28jsnn9c', '清蛋糕10吋', '50400005', '150400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oad4_xdcencjl', '清蛋糕12吋', '50400006', '150400006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oad6_yntfdwvb', '清蛋糕14吋', '50400007', '150400007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oad9_n7k4wqmk', '奶油蛋糕10吋', '50400008', '150400008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadb_4ipoqe2s', '奶油蛋糕12吋', '50400009', '150400009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadd_y8jxcmtp', '奶油蛋糕8吋', '50400010', '150400010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadg_bnkp7f0b', '奶油蛋糕14吋', '50400011', '150400011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadj_y0ffg0ei', '海綿蛋糕', '50400012', '150400012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadm_iyglsw8z', '起司蛋糕', '50400013', '150400013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadq_du6l83pd', '起酥蛋糕', '50400014', '150400014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadt_4fz6ftku', '乳酪蛋糕', '50400015', '150400015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oadw_m5p2e28b', '黑森林蛋糕8吋', '50400016', '150400016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oady_2jzqzbyi', '大餐包', '50400017', '150400017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oae1_1tr57tcg', '小餐包', '50400018', '150400018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oae3_uysuot7g', '大漢堡麵包', '50400019', '150400019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oae6_gpiekqa4', '小漢堡麵包', '50400020', '150400020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oae9_jnizu7ju', '大亨堡麵包', '50400021', '150400021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaeb_os4mb589', '全麥吐司', '50400022', '150400022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaed_1ni6tge9', '吐司', '50400023', '150400023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaeg_f1rra9vr', '厚片吐司', '50400024', '150400024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaei_z3e5uvog', '紅豆吐司', '50400025', '150400025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oael_34t5efka', '甜麵包', '50400026', '150400026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaen_aakx0oy8', '鹹麵包', '50400027', '150400027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaeq_xvpe0jfb', '菠蘿麵包', '50400028', '150400028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaet_0b5nge25', '肉鬆麵包', '50400029', '150400029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaev_p9icb1wg', '紅豆麵包', '50400030', '150400030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaex_s9zbb0c3', '草莓麵包', '50400031', '150400031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaez_g3ar6mxu', '蔥花麵包', '50400032', '150400032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaf1_mx13sgs8', '牛角麵包', '50400033', '150400033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaf4_yt6787if', '可頌麵包', '50400034', '150400034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaf6_23zxrcaq', '小可頌麵包', '50400035', '150400035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaf8_42x852g9', '奶酥麵包', '50400036', '150400036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafb_kfaj3m7c', '芋頭麵包', '50400037', '150400037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafd_cjze8rju', '全麥麵包', '50400038', '150400038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaff_4xt83h0q', '花生麵包', '50400039', '150400039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafi_u3178kb8', '小熱狗麵包', '50400040', '150400040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafk_5m1hgbai', '椰子麵包', '50400043', '150400043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafn_bc7m8atu', '奶酥餐包', '50400044', '150400044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafp_68jfoqyc', '乳酪棒', '50400045', '150400045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafr_gcmzmx19', '德式香腸-原味/0.6K', '50400046', '150400046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaft_gmlhtltp', '乳酪粉', '50400047', '150400047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafv_ey6c5clp', '銅鑼燒', '50400048', '150400048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafx_vrzde19i', '銅鑼燒(禮盒)', '50400049', '150400049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oafz_616e6i6z', '30元餐盒', '50410001', '150410001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oag1_ruomgmlh', '40元餐盒', '50410002', '150410002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oag4_jopkf7dh', '50元餐盒', '50410003', '150410003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oag6_0q8g7dmz', '60元餐盒', '50410004', '150410004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oag8_fswjdqxc', '75元餐盒', '50410005', '150410005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagb_49iih9v0', '80元餐盒', '50410006', '150410006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagd_f8w5qgal', '白油麵', '50500001', '150500001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagg_z2qrp3bj', '黃油麵', '50500002', '150500002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagi_55ue6xr1', '米苔目', '50500003', '150500003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagl_nei5t4xc', '板條', '50500004', '150500004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagn_02zp2oqu', '烏龍麵', '50500005', '150500005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagq_z12t889n', '拉麵', '50500006', '150500006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oags_xrstdlbw', '陽春麵', '50500007', '150500007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagv_616ui1e9', '水餃皮', '50500008', '150500008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oagx_aiztp7v3', '餛飩皮', '50500009', '150500009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oah0_64n26bpz', '蛋餅皮', NULL, '150500010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oah2_hosw9687', '潤餅皮', '50500011', '150500011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oah5_hfn2h4ya', '涼麵', '50500012', '150500012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oah8_t1hz6y1l', '鐵板麵', '50500013', '150500013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaha_1z757w5r', '高麗菜手工水餃', '50500014', '150500014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oahd_jsxv6o5e', '韭菜手工水餃', '50500015', '150500015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oahg_xemdlcnj', '素食手工水餃', '50500016', '150500016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oahi_kwzjgdkg', '年糕條', '50500017', '150500017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oahk_iljqp1v2', '麵疙瘩', '50500018', '150500018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaht_8q7kbr6k', '蘭花干', '50600001', '150600001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oahw_wov2bg95', '麵腸', '50600002', '150600002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oahz_xtycqyfa', '素火腿', '50600003', '150600003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oai2_bktaiyok', '素火腿排', '50600004', '150600004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oai5_hn8qxe2b', '蒟蒻卷', '50600005', '150600005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oai8_9q2l6xzj', '蒟蒻腰花', '50600006', '150600006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaib_99x7ecxi', '蒟蒻蝦仁', '50600007', '150600007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaid_2gpxaumu', '蒟蒻白魷魚', '50600008', '150600008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaig_0d43mtbv', '素米血丁', '50600009', '150600009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaij_68rt07gg', '素米血', '50600010', '150600010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaim_70uhm8lw', '素羊肉', '50600011', '150600011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaio_ri23yxg5', '素絞肉', '50600012', '150600012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaiq_ac0b4dp9', '素東坡肉', '50600013', '150600013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oait_jyi5v3ot', '素春捲', '50600014', '150600014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaiv_5f73auwh', '蔬菜豆腐', '50600015', '150600015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaix_cyhko75v', '素茶鴨片', '50600016', '150600016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaj0_der1oigx', '素龍鳳腿', '50600017', '150600017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaj3_eirat4hk', '素水餃', '50600018', '150600018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaj5_y6d80rte', '素粽', '50600019', '150600019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaj8_9uzqo0x1', '素雞丁', '50600020', '150600020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaja_sp50goq2', '素雞翅', '50600021', '150600021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajd_fyvkb614', '素雞排', '50600022', '150600022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajf_pvtra556', '素雞塊', '50600023', '150600023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaji_jfcdpc2o', '素黑胡椒肉排', '50600024', '150600024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajl_yap0qnau', '素蟳肉排', '50600025', '150600025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajo_rwmquju8', '素鱈魚排', '50600026', '150600026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajq_8krpjm2v', '素烤鴨', '50600027', '150600027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajv_h6n3zjaa', '小清丸', '50600028', '150600028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oajy_gna888c7', '素雞', '50600029', '150600029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oak1_49cb5pay', '素魚翅', '50600030', '150600030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oak3_x04y1avm', '素排骨', '50600031', '150600031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oak5_b5qg68zs', '烤麩', '50600032', '150600032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oak8_vhs4rxnk', '素獅子頭', '50600033', '150600033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakb_k7abfeco', '素肉羹', '50600034', '150600034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakd_enufzg40', '素肚', '50600035', '150600035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakg_0ebu4gkg', '素香菇貢丸', '50600036', '150600036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaki_5yjeg53b', '素三牲', '50600037', '150600037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakl_y74xrchw', '素燒肉丸子', '50600038', '150600038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oako_d1esnm6n', '素翠玉鮮排', '50600039', '150600039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakq_w1l63b9p', '素紅麴排', '50600040', '150600040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaks_hb8xru30', '素吳郭魚', '50600041', '150600041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakv_dcqp2gpc', '蒟蒻紅魷魚', '50600042', '150600042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakx_c41ph1hj', '壽司皮', '50600043', '150600043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oakz_g441gmte', '碳烤素排', '50600044', '150600044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oal2_pnw7liuc', '麵腸(溫)', '50600045', '150600045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oal4_x1s86fi2', '素鵝卷', '50600046', '150600046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oal6_hqpzv653', '素清丸', '50600047', '150600047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oal8_pm98ikp3', '素茶鵝片', '50600048', '150600048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalc_wz7bsnqv', '素香菇肉燥', '50600049', '150600049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oale_nvbyp9p3', '素鮭魚片', '50600050', '150600050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalh_r6qsk5yv', '素燻茶鵝', '50600051', '150600051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalj_offd8jpq', '素香椿鮮排', '50600053', '150600053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oall_v8ztdk7l', '素鱈魚片', '50600054', '150600054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaln_ccqsx9ni', '素白玉球', '50600055', '150600055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalp_tymxqwbl', '素小龍肉', '50600056', '150600056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalr_yh573y3c', '米血丁', '60100001', '160100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalt_r9k7r3ng', '米血糕-5片裝', NULL, '160100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oalw_xv4rskv7', '鑫鑫腸', '60100003', '160100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaly_qioz7p15', '香腸', '60100004', '160100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oam0_ltsr6xqz', '香腸片', '60100005', '160100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oam2_d7bbh523', '火腿丁', '60100006', '160100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oam4_wc8sfpbg', '火腿片', '60100007', '160100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oam6_wuui2cmq', '火腿絲', '60100008', '160100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oam8_vwjo8z5i', '漢堡肉排', '60100009', '160100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oama_xl5emmlg', '培根片', '60100010', '160100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamd_6a2la4l3', '大熱狗', '60100011', '160100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamf_5oov6nwt', '小熱狗', '60100012', '160100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamg_h5mz49e7', '獅子頭', NULL, '160100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamj_scfzj80v', '排骨酥', '60100014', '160100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaml_tyyam68y', '豬血', '60100015', '160100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamn_86ej6277', '刺瓜封', '60100016', '160100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamp_bn4al4jk', '苦瓜封', '60100017', '160100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oams_1aiqh5sn', '培根條', '60100018', '160100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamu_bqamhjrw', '培根丁', '60100019', '160100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oamz_f0ta5rmy', '香腸(保億)', '60100020', '160100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oan1_jzyl4p3j', '卡啦雞腿排-XL(原味)', '60200001', '160200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oan4_xyulhok7', '卡拉雞腿排(國產)', '60200002', '160200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oan6_ogyrhvbb', '卡啦雞腿排-M(原味)', '60200003', '160200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oan9_t22p6vfz', '法式香榭腿排-L', '60200004', '160200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanb_56jcpy5v', '卡拉蝴蝶腿', '60200005', '160200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oand_vgbszxbo', '卡拉雞腿排', '60200006', '160200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanf_jyxhdefp', '雞堡', '60200007', '160200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanh_lztrsoll', '麥克雞塊', '60200008', '160200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanj_3z8k6osf', '翅小腿', '60200009', '160200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanl_hom05frm', '太空雞', '60200010', '160200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oano_59bidyps', '對切雞排', '60200011', '160200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanq_3dvhzybm', '去骨雞腿排', '60200012', '160200012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oant_mq9sm3th', '土雞(溫)', '60200013', '160200013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oanv_s2d66g1i', '土雞塊(溫)', '60200014', '160200014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oany_n2jve5k7', '仿雞(溫)', '60200015', '160200015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oao1_jm1sfnmb', '仿雞塊(溫)', '60200016', '160200016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oao3_j5kzba9g', '燉雞1.2KG', '60200017', '160200017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oao5_t48c6tnq', '雞腿(溫)', '60200018', '160200018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oao9_854bczjs', '雞翅(溫)', '60200019', '160200019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaob_tb1htbb0', '卡拉雞腿堡(大贏家)', '60200020', '160200020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaoe_dmrpa1pg', '調理三節翅W6', '60200021', '160200021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaog_ukyme153', '鹽水雞', '60200022', '160200022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaoj_a6us5mlo', '麥克雞塊-卜蜂', '60200023', '160200023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaom_h0dmjgf3', '太空鴨', '60300001', '160300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaop_kjk2cxay', '鴨丁', '60300002', '160300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaor_8p5ppymc', '茶鴨', '60300003', '160300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaou_ynwts09c', '烤鴨', '60300004', '160300004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaow_lrwp4hkh', '三牲', '60300005', '160300005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaoz_b4ru8zb2', '三角鴨胸肉', '60300006', '160300006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oap1_96zlxk9s', '鴨腱', '60300007', '160300007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oap4_1wtxtdqy', '鴨舌', '60300008', '160300008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oap7_qca8izue', '鴨翅', '60300009', '160300009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapa_5oq1dghm', '鴨腿', '60300010', '160300010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapg_h6vv82kd', '鹹水鴨', '60300011', '160300011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapj_dncq9k5l', '煙燻茶鵝', '60300012', '160300012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapm_m3tc64bn', '鴕鳥肉', '60400001', '160400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapp_hw32s3e6', '冷凍三色豆', '61000001', '161000001', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapr_7vomn0r9', '冷凍玉米粒', '61000002', '161000002', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapu_vnse6vxo', '冷凍毛豆仁', '61000003', '161000003', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oapz_u1veevii', '冷凍青豆仁', '61000004', '161000004', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaq3_l4fcnwiv', '冷凍青花', '61000005', '161000005', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaq5_ku9pnqat', '冷凍白花', '61000006', '161000006', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaq7_srp0grsg', '冷凍紅蘿蔔丁', '61000007', '161000007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaq9_2l4gs3id', '冷凍毛豆莢', '61000009', '161000009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqc_ciamwx09', '冷凍芋頭角', '61000010', '161000010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqe_inr9vz6g', '冷凍芋香毛豆仁CAS', '61000011', '161000011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqh_eaosvpdx', '冷凍青花CAS', '61000012', '161000012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqk_6yxzz49l', '冷凍白花CAS', '61000013', '161000013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqm_yjd76v1t', '冷凍毛豆仁CAS', '61000014', '161000014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqp_st7a44yv', '冷凍馬鈴薯丁', '61000015', '161000015', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqr_p4afqh87', '土魠魚', '70100001', '170100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqt_ib1oqt6l', '花枝排/100片', '70100002', '170100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaqx_4zdq8056', '鮮蝦排', '70100004', '170100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oar0_aw29o9qd', '海鮮排', '70100005', '170100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oar2_oc010ztu', '鯛魚排', '70100006', '170100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oar5_cxho61e2', '花枝卷(源)', '70100007', '170100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oar6_15pxdrwu', '蝦卷(源)', '70100008', '170100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oar8_kl4ovrqu', '甜不辣', '70100009', '170100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oarb_v3lfstco', '黑輪條CAS(如記)', '70100010', '170100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oare_g0gphdsp', '黑輪條CAS(立品)', '70100011', '170100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oarh_az1tmtpx', '火鍋料', '70100012', '170100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oarj_u3gxisi2', '蟹肉棒', '70100013', '170100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oarm_agxxcnzm', '魚板', '70100014', '170100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaro_vzq67msv', '魚板絲', '70100015', '170100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oarq_gdiavgzp', '燕餃', '70100016', '170100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oart_mzk6wrqp', '蝦餃', '70100017', '170100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oary_5gzj4p1x', '蛋餃', '70100018', '170100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oas2_k26jn4li', '魚餃', '70100019', '170100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oas4_kwxc0r18', '花枝排/40片', '70100020', '170100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oas6_auc58gtn', '魚漿', '70100021', '170100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oas8_x7w9bf07', '北海翅', '70100022', '170100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasa_xhr3y10j', '魚卵卷', '70100023', '170100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasd_9fz4038m', '甜不辣CAS(如記)', '70100024', '170100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasf_g2giq2ll', '黑輪片CAS(立品)', '70100025', '170100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oash_qfx5rdqs', '裙帶絲', '70100026', '170100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oask_e9ewelcm', '鮭魚', '70100027', '170100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasn_7qclnqip', '桂花參', '70100028', '170100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasp_opmnzs2z', '切片魚板(翊)', '70100029', '170100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oass_oumzr21o', '魚豆腐(翊)', '70100030', '170100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasu_wclrj321', '黃金魚蛋(翊)', '70100031', '170100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oasx_8dez2nde', '蝦味球(翊)', '70100032', '170100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oat0_n336iqkr', '蜜汁香魚', '70100033', '170100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oat4_j00f9bcx', '鮭魚切片', '70100034', '170100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oat7_arjvdsf6', '福州丸(源)', '70200001', '170200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oata_ubd2p571', '大貢丸', '70200002', '170200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatd_xydwvop8', '小貢丸', '70200003', '170200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatg_ahx334xk', '貢丸切片', '70200004', '170200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oati_n29enrc9', '肉羹', '70200005', '170200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatl_ajxqal3u', '肉卷(飯店)', '70200006', '170200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatn_n334hci8', '小魚丸', '70200007', '170200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatp_cypgxtn7', '虱目魚丸(源)', '70200008', '170200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oats_dodz22lk', '花枝丸(源)', '70200009', '170200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatu_l40a249p', '香菇貢丸', '70200010', '170200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oatw_qld72g00', '海苔肉卷', '70200011', '170200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaty_n9qa1mbf', '福州丸(翊)', '70200012', '170200012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oau0_e1dpmjl8', '肉羹CAS', '70200013', '170200013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oau2_udozphd6', '鴨肉丸', '70200014', '170200014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oau5_p2jla5gb', '土雞蛋', '80100001', '180100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oau8_shhyxdbc', '雞蛋(粒)', '80100002', '180100002', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaub_bw0mvori', '雞蛋', '80100004', '180100004', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaud_f1caa9pu', '鹹蛋', '80100005', '180100005', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oauf_u23dieth', '皮蛋', '80100006', '180100006', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaui_3d5ntwsx', '滷蛋', '80100007', '180100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oauk_0qlyuorh', '鴨蛋', '80100008', '180100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaum_grfhbvy5', '鳥蛋(鵪鶉蛋)', '80100009', '180100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaup_v95iswy5', '鹹蛋黃', '80100010', '180100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaus_z78n84pe', '三角油豆腐', '90100001', '190100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oauv_aovzomfp', '方油豆腐', '90100002', '190100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaux_oou6ns3a', '百頁豆腐', '90100003', '190100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oav0_5i8yqmyd', '大溪豆干', '90100004', '190100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oav2_rp7ziz3b', '五香豆干', '90100005', '190100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oav5_wuh4gsaf', '小印干', '90100006', '190100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oav8_poxiipet', '豆干片', '90100007', '190100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavb_6k2icwlp', '豆干丁', '90100008', '190100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oave_uvfwvnfr', '豆干絲', '90100009', '190100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavh_cki9z7f8', '豆包', '90100010', '190100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavj_ro3hoer7', '豆干(溫)', '90100011', '190100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavm_xqbrwlyf', '豆干片(溫)', '90100012', '190100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavo_5cwes0ar', '豆干絲(溫)', '90100013', '190100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavr_cdgsh2z8', '白干絲(溫)', '90100014', '190100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavv_1lsoku8k', '豆干丁(溫)', '90100015', '190100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oavy_5iic2a0j', '油豆腐(溫)', '90100016', '190100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaw1_jhtg74ef', '豆腸', '90100017', '190100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaw5_1pj8o87l', '豆包(溫)', '90100018', '190100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaw8_y205z629', '豆干條(溫)', '90100019', '190100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oawa_ooq0qglm', '油豆泡', '90100020', '190100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oawd_hcb274oq', '三角油豆腐(溫)', '90100021', '190100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oawi_o5xiav4b', '炸豆包', '90100022', '190100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oawn_jvpb8izz', '煙燻豆包', '90100023', '190100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oawp_bprfskqg', '凍豆腐', '90200001', '190200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oawt_85uowsft', '板豆腐(盒)', '90200002', '190200002', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaww_y3o3fva0', '火鍋豆腐(大漢)', '90200003', '190200003', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oax0_th5cqb4h', '火鍋豆腐(中華)', '90200004', '190200004', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oax3_jlxnm76o', '超嫩豆腐', '90200005', '190200005', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oax5_ebtp8tyz', '雞蛋豆腐', '90200006', '190200006', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oax8_o7jdsyqa', '家常豆腐', '90200007', '190200007', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxa_c55bwzq6', '臭豆腐', '90200008', '190200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxc_refpjo0v', '中華板豆腐', '90200009', '190200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxf_d0xmt6wx', '二砂糖/1KG', 'A0100001', '210100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxi_yjd0qosv', '二砂糖/25KG', 'A0100002', '210100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxl_w40jn29c', '鹽', 'A0100003', '210100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxo_gv0hyw30', '醬油膏/3.785L', 'A0100004', '210100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxq_xq10h5pq', '醬油/5L', 'A0100005', '210100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxt_tuotkaoj', '醬油/550g', 'A0100006', '210100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxw_emr8u9ic', '蕃茄醬(大)/3.3KG', 'A0100007', '210100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaxz_bdrvypl7', '蕃茄醬(小)/700g', 'A0100008', '210100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oay2_aclxqq0d', '香菇素蠔油/6KG', 'A0100009', '210100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oay5_e04vekxc', '咖哩粉', 'A0100010', '210100010', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oay8_w8k4s8ey', '素食咖哩塊', 'A0100011', '210100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayb_8ih54oxx', '沙茶醬(大)牛頭牌/3KG', 'A0100012', '210100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayf_0jwatxpj', '沙茶醬(中)牛頭牌/737g', 'A0100013', '210100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayi_de05ouww', '韓式辣醬', 'A0100014', '210100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayl_yl8f4j50', '素沙茶醬', 'A0100015', '210100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayp_5j9yecti', '不辣豆瓣醬/460G', 'A0100016', '210100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oays_clsa7x4i', '辣豆瓣醬(大)/2.7KG', 'A0100017', '210100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayv_q5zvhw06', '辣豆瓣醬(小)/460g', 'A0100018', '210100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oayy_kzret6wq', '白醋(中)/600cc', 'A0100019', '210100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaz1_7k9meghl', '白醋/5L', 'A0100020', '210100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaz5_v6zvm3py', '烏醋(中)/600cc', 'A0100021', '210100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oaz8_uje694id', '烏醋(大)/5L', 'A0100022', '210100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazc_vhd88vky', '辣椒醬/3KG', 'A0100023', '210100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazf_bnkld6hu', '辣椒醬/460g', 'A0100024', '210100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazh_plkxciki', '甜辣醬/5KG', 'A0100025', '210100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazk_hsa51e3f', '白胡椒粉', 'A0100026', '210100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazo_r0o96vzp', '黑胡椒粒', 'A0100027', '210100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazs_xh06upsb', '胡椒鹽', 'A0100028', '210100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazw_9mltiz2z', '五香粉', 'A0100029', '210100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oazz_44u2p770', '花椒粒', 'A0100030', '210100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob03_e2r1zb38', '高湯塊', 'A0100031', '210100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob07_jq8hd2mk', '雞粉', 'A0100032', '210100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob0a_48xu5dae', '泰式燒雞醬', 'A0100033', '210100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob0l_a9xc3p6x', '味醂', 'A0100034', '210100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob0p_oghdmetk', '山葵粉', 'A0100035', '210100035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob0s_rwsnrkpk', '紅麴醬(小)', 'A0100036', '210100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob0w_trzswpvm', '咖哩粉-玻璃罐', 'A0100037', '210100037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob10_zgkakl70', '濃湯粉', 'A0100038', '210100038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob13_c9d0ufm0', '太白粉/3KG', 'A0100039', '210100039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob19_eb0w6rkj', '太白粉/20KG', 'A0100040', '210100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1d_1zfv9vji', '地瓜粉/3KG', 'A0100041', '210100041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1g_jvrd0z3i', '地瓜粉/20KG', 'A0100042', '210100042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1k_wdz6tkll', '蒸肉粉/300g', 'A0100043', '210100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1o_rskqwnqt', '低筋麵粉/3KG', 'A0100044', '210100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1r_pn6u646w', '低筋麵粉/22KG', 'A0100045', '210100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1u_0v5yuiyx', '中筋麵粉/3KG', 'A0100046', '210100046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob1x_gv2iiz7h', '泡打粉/罐', 'A0100047', '210100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob20_5ym36f54', '高筋麵粉/3KG', 'A0100048', '210100048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob24_c0d079el', '高筋麵粉/22KG', 'A0100049', '210100049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob27_erb9ur34', '三花-地瓜粉/20KG', 'A0100050', '210100050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2a_qd3lfjen', '酥脆粉', 'A0100051', '210100051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2d_61wjb656', '雞湯塊', 'A0100052', '210100052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2g_krbwzxgf', '魚露', 'A0100053', '210100053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2k_xnrzyi8t', '豆酥粉/0.6K', 'A0100054', '210100054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2n_defo0m0l', '麵包粉', 'A0100055', '210100055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2q_andxejqp', '味精', 'A0100056', '210100056', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2t_dy70rl4q', '蘇打粉', 'A0100057', '210100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2w_4scqxyag', '花椒粉', 'A0100058', '210100058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob2z_xxzdjlq4', '細砂', 'A0100059', '210100059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob33_j0jmvvga', '咖哩塊', 'A0100060', '210100060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob36_h6x8pgph', '不辣豆瓣醬/3KG', 'A0100061', '210100061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3a_faft3tv3', '柴魚粉', NULL, '210100062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3d_qnil33m7', '白砂糖', 'A0100063', '210100063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3g_d3rk3oqs', '沙茶醬(中)福華/737g', 'A0100064', '210100064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3j_4r4x3tyq', '花椒粒/12G', 'A0100065', '210100065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3n_t8ngfi13', '醬油/2L(龜甲萬)', 'A0100066', '210100066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3q_z7zwom5e', '沙茶醬(小)牛頭牌/250g', 'A0100067', '210100067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3s_r58pniwb', '孜然粉', 'A0100068', '210100068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob3w_5tvj71m1', '和風醬', 'A0100069', '210100069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob40_zppw6t75', '康寶濃湯包', 'A0100070', '210100070', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob43_ynjje937', '老抽/6KG', 'A0100071', '210100071', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob46_vtsttyi6', '糯米粉600g', NULL, '210100072', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob49_e6ys6jsu', '醬油膏6L', 'A0100075', '210100075', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4c_7jzuq2bt', '圓花瓜', 'A0200001', '210200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4g_t7wbigj6', '花瓜罐170g', 'A0200002', '210200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4j_ujqxk6k9', '花瓜罐400g', 'A0200003', '210200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4m_lnqg57tx', '絞瓜/3KG', 'A0200004', '210200004', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4p_835g4r55', '蔭瓜罐140g', 'A0200005', '210200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4s_fccojtch', '蔭瓜罐/3KG', 'A0200006', '210200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4u_g3p0zirp', '醋薑片', 'A0200007', '210200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4x_icrxeb3d', '榨菜絲', 'A0200008', '210200008', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob4z_nliama0c', '辣蘿蔔條', 'A0200009', '210200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob52_geqwdjb3', '牛蒡絲', 'A0200011', '210200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob55_bhem6tm0', '甜醋薑片', 'A0200012', '210200012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob58_uj85yuo9', '韓式泡菜', 'A0200013', '210200013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5b_gy3pzqwm', '碎菜脯', 'A0200014', '210200014', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5d_oi8tm562', '菜脯條', 'A0200015', '210200015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5g_8r6paqjc', '福菜乾-朴菜', 'A0200016', '210200016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5j_57ec2ef9', '冬菜', 'A0200017', '210200017', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5m_1iaekiji', '福菜切絲-朴菜', 'A0200018', '210200018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5p_ka9e6xum', '酸菜白絲', 'A0200019', '210200019', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5r_oj5ts89n', '酸菜黑絲', NULL, '210200020', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5u_r48z7kmr', '辣榨菜', 'A0200021', '210200021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5x_3osfskzm', '蔭瓜醬/4.5KG', 'A0200024', '210200024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob5z_1r8z7yii', '剝皮辣椒', 'A0200025', '210200025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob62_d74ajyh5', '白脆筍絲', 'A0200026', '210200026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob65_fnlxoy1w', '醃黃蘿蔔', 'A0200027', '210200027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob68_0d3xedsp', '螺肉罐頭', 'A0200029', '210200029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6b_twult2bd', '冰糖', 'A0300001', '210300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6e_r0b52ibe', '黑糖粉', 'A0300002', '210300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6h_et6x2wds', '油蔥酥', 'A0300004', '210300004', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6k_lz78k90m', '蒜頭酥', 'A0300005', '210300005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6n_e71wxnp7', '味噌-粗', 'A0300006', '210300006', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6p_e23vb9n2', '味噌', 'A0300007', '210300007', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6s_ynpu0gqa', '桂冠沙拉醬/100g', 'A0300008', '210300008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6u_5ilnfvgv', '桂冠沙拉醬/500g', 'A0300009', '210300009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob6x_w4m03ciu', '味全沙拉醬/500g', 'A0300010', '210300010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob70_gfdidg1z', '調理包', 'A0300011', '210300011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob73_5s8ibvm1', '鳳梨罐頭-切片(小)/565g', 'A0400001', '210400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob76_3w4sowgw', '鳳梨罐頭-切角(大)/3KG', 'A0400002', '210400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob79_90a8pe35', '鮪魚罐頭(大)/1.88KG', 'A0400003', '210400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7c_jtvmv4fi', '鮪魚罐頭(小)/185g', 'A0400004', '210400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7f_8exyevz4', '麵筋罐(大)/3KG', 'A0400005', '210400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7i_lvnyl6p2', '麵筋罐/170g', 'A0400006', '210400006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7l_ehh6m3ln', '土豆麵筋/3KG', 'A0400007', '210400007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7n_beqvc2ny', '甜酒豆腐乳/800g', 'A0400008', '210400008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7q_rwps7k4u', '甜酒豆腐乳/390g', 'A0400009', '210400009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7t_b84fhjk7', '茄汁鯖魚(大)/445g', 'A0400010', '210400010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7v_ywk6u7to', '樹子(小)/380g', 'A0400011', '210400011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob7x_5gwoc743', '樹子(大)/3KG', 'A0400012', '210400012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob80_5liqrgyb', '玉米粒罐(小)/340g', 'A0400013', '210400013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob83_9alqyawl', '玉米粒罐(大)/2.1KG', 'A0400014', '210400014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob87_88f5rf3p', '玉米醬(小)/425g', 'A0400015', '210400015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8a_er28hbwe', '玉米醬(大)/3KG', 'A0400016', '210400016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8d_6bdy2sdy', '蘑菇醬(中)/850g', 'A0400017', '210400017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8f_owmz16ml', '蘑菇醬(大)/3KG', 'A0400018', '210400018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8i_wub63vbe', '義大利肉醬(中)/800g', 'A0400019', '210400019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8l_ogujybig', '義大利肉醬(大)/3KG', 'A0400020', '210400020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8o_ry9nzre8', '芝麻醬/500g', 'A0400021', '210400021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8r_urcjdpxu', '芝麻醬/2.7KG', 'A0400022', '210400022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8u_u33sd2l5', '鹹鳳梨/380g', 'A0400023', '210400023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8x_n9xer8mm', '鹹冬瓜/3KG', 'A0400024', '210400024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob8z_c0gzsa8f', '甜麵醬/200g', 'A0400025', '210400025', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob93_k9qi5gpv', '甜麵醬(中)/460g', 'A0400026', '210400026', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob96_jzo9mkit', '甜麵醬(大)/3.1KG', 'A0400027', '210400027', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob98_xu3l47vw', '黑胡椒醬/800g', 'A0400028', '210400028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9b_3qans6fw', '黑胡椒醬/3KG', 'A0400029', '210400029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9d_6fngyv2a', '甜辣醬/340g', 'A0400030', '210400030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9g_9ozqmfen', '花生麵筋/300g', 'A0400031', '210400031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9j_zcr5c2ap', '辣味肉醬', 'A0400032', '210400032', '罐', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9m_lvcfyy3q', '蜜汁烤肉醬', 'A0400033', '210400033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9p_2ouywj6o', '茄汁鯖魚(小)/230g', 'A0400034', '210400034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9s_cqt50ofc', '紅燒鰻魚罐頭', 'A0400035', '210400035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9u_u670n9ji', '紅燒小卷罐頭', 'A0400036', '210400036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ob9x_za5i409h', '元本山海苔', 'A0400037', '210400037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oba0_869zrrnt', '馬鈴薯蘑菇濃湯包', 'A0400038', '210400038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oba3_x8zniclv', '加鈣營養餅乾', 'A0400039', '210400039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oba5_maq5tpjv', '桂格濃湯燕麥(鮮蔬蘑菇)', 'A0400040', '210400040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oba8_j6kj0sbi', '桂格濃湯燕麥(洋蔥起司)', 'A0400041', '210400041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obab_dt8cb4fu', '五木拉麵', 'A0400042', '210400042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obae_quzexmu8', '刀削麵', 'A0400043', '210400043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obag_5boido7z', '蠔油510ml', 'A0400044', '210400044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obaj_pbuci4af', '醬油膏600ML', 'A0400045', '210400045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obal_emr5ytnb', '萬歲牌芝麻堅果飲', 'A0400046', '210400046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obao_2p0fytyb', '桂格麥片', 'A0400047', '210400047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obar_ymkonw5t', '綜合纖果', 'A0400048', '210400048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obau_e20rrrk5', '經典可可麥片', 'A0400049', '210400049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obaw_gt17kktb', '桂格濃湯燕麥(蕃茄牛肉)', 'A0400050', '210400050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obaz_y3ie2f3k', '桂格濃湯燕麥(白醬雞肉)', 'A0400051', '210400051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obb1_ihev9aml', '桂格濃湯燕麥(奶油玉米)', 'A0400052', '210400052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obb4_627qn3ap', '蛋捲', 'A0400053', '210400053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obb6_g7i5p284', '米果', 'A0400054', '210400054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obb9_mdrcyhoe', '桂格可可穀片', 'A0400055', '210400055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbb_4hwk90x5', '桂格玉米片', 'A0400056', '210400056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbe_ffgsiyfp', '康寶獨享杯', 'A0400057', '210400057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbh_afyhsj2d', '桂格濃湯燕麥(可可鮮莓)', 'A0400058', '210400058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbj_9lfjt02y', '奶酥醬/1KG', 'A0500001', '210500001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbn_6kbiglh7', '巧克力醬/3KG', 'A0500002', '210500002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbp_xebq6h4m', '巧克力醬/1KG', 'A0500003', '210500003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbs_rnp38sor', '草莓果醬/3KG', 'A0500004', '210500004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obbv_3zcsdz4s', '草莓果醬/450g', 'A0500005', '210500005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obby_6cjm28zv', '花生醬/3KG', 'A0500006', '210500006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obc0_s9mwauvl', '巧克力醬/250g', 'A0500007', '210500007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obc3_bmbg7k5f', '藍莓果醬/900g', 'A0500008', '210500008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obc6_jmoz08xo', '花生醬/900g', 'A0500009', '210500009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obc9_39pr897o', '煉乳/1400g', 'A0600001', '210600001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcb_n1m7bner', '煉乳/375g', 'A0600002', '210600002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obce_i7a0vq4a', '椰奶(小)', 'A0600003', '210600003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcg_3eru3uvp', '八寶粥', 'A0600004', '210600004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcj_idwa4umk', '阿華田(大)/1.8KG', 'A0600005', '210600005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcl_ridm4tc0', '奶精粉/1KG', 'A0600006', '210600006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcn_20r9m33h', '米漿粉', 'A0600007', '210600007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcq_8h2z4xd7', '豆漿粉', 'A0600008', '210600008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcs_dk2i37z2', '豆花粉', 'A0600009', '210600009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcu_5skuz7hh', '珍珠粉圓', 'A0600010', '210600010', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcw_dxkbs8he', '七彩米', 'A0600011', '210600011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obcy_y9ngt4cz', '玉米片', 'A0600012', '210600012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obd1_bmwohbc0', '起司片', 'A0600013', '210600013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obd4_hazgszzo', '布丁粉', 'A0600014', '210600014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obd8_v0gx614m', '燒仙草罐', 'A0600015', '210600015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obda_xc7z20pa', '花生糖粉', 'A0600016', '210600016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdd_d75zncts', '果凍粉', 'A0600017', '210600017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdf_vzfcxs7v', '芒果果凍粉', 'A0600018', '210600018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdi_a86usbi5', '草莓果凍粉', 'A0600019', '210600019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdl_j4pa4g5o', '藍莓果凍粉', 'A0600020', '210600020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdo_ppjnzmr2', '愛玉凍粉', 'A0600021', '210600021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdr_kw2nuzsd', '杏仁粉', 'A0600022', '210600022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdu_0rjmozuy', '吉利丁片', 'A0600023', '210600023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdx_byzvcq4r', '吉利丁粉', 'A0600024', '210600024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obdz_svnw10yb', '仙草汁', 'A0600025', '210600025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obe2_s55ymvwx', '仙草凍', 'A0600026', '210600026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obe5_qm5ep6ck', '仙草', 'A0600027', '210600027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obe8_ep6exru6', '愛玉凍(大湖)2.8KG', 'A0600028', '210600028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obea_4bya49iw', '熟粉條', 'A0600029', '210600029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obed_z6wutwxo', '粉粿', 'A0600030', '210600030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obef_gsty1zm3', '酒釀', 'A0600031', '210600031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obei_ztceyn68', '核桃', 'A0600032', '210600032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obek_29bf6mc2', '葡萄乾', 'A0600033', '210600033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obem_y8o9ghag', '五彩米', 'A0600034', '210600034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obep_8ewfbsy3', '愛玉', 'A0600035', '210600035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obes_7gniwa13', '白米-大(30k)', 'A0700001', '210700001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obev_e3j2ycsf', '農糧米', 'A0700002', '210700002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obey_5vxkhcj4', '長糯米', 'A0700003', '210700003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obf1_u92s20iv', '圓糯米', 'A0700004', '210700004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obf4_k4iu5861', '雜糧米', 'A0700005', '210700005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obf6_xip3070e', '五穀米', 'A0700006', '210700006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obf9_vr6bwvbm', '紫米', 'A0700007', '210700007', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfc_x874p08g', '糙米', 'A0700008', '210700008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obff_jv4ltn9a', '白米-小(2k)', 'A0700009', '210700009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfh_nem7msf3', '黑米', 'A0700010', '210700010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfk_rkcxcgt8', '台梗九號米', 'A0700011', '210700011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfn_15qqaru6', '沙拉油/18L', 'A0800001', '210800001', '桶', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfq_2ev5qvj1', '沙拉油/3KG', 'A0800002', '210800002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obft_z2g84vc4', '沙拉油/600g', 'A0800003', '210800003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfw_sedknw8c', '香油/2.8L', 'A0800004', '210800004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obfz_bvehmi34', '香油/520g', 'A0800005', '210800005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obg1_qi4ypt5u', '麻油(大)/2.8L', 'A0800006', '210800006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obg3_scc8hhvv', '麻油(小)/520cc', 'A0800007', '210800007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obg6_bgetgn54', '奶油', 'A0800008', '210800008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obg8_cjutfx22', '橄欖油', 'A0800009', '210800009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgc_8ljiia7p', '豬油', 'A0800010', '210800010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgf_go8kllhg', '炸油', 'A0800011', '210800011', '桶', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgj_6hvgxu1m', '高粱酒/500L', 'A0900001', '210900001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgl_qhiajr9d', '蔘茸酒', 'A0900002', '210900002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgo_vvie8jrw', '紹興酒', 'A0900003', '210900003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgr_0dgiy1k6', '玻璃紅標米酒/600g', 'A0900004', '210900004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgt_d3b69x34', '米酒/550L', 'A0900005', '210900005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgw_u5mrt2me', '米酒瓶', 'A0900006', '210900006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obgz_r5z4sjze', '米酒箱', 'A0900007', '210900007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obh2_1hlbylif', '紅棗', 'A1000001', '211000001', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obh5_x78wral5', '人蔘鬚', 'A1000002', '211000002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obh8_egvna85i', '枸杞', 'A1000003', '211000003', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obha_csfu00mh', '當歸片', 'A1000004', '211000004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhc_zhokrwy5', '燒酒雞藥包', 'A1000005', '211000005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhf_8brjaq81', '薑母鴨中藥包', 'A1000006', '211000006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhh_iodp394y', '四神藥包', 'A1000007', '211000007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhk_cv55kgb9', '肉骨茶包', 'A1000008', '211000008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhm_k0xxvwuq', '當歸藥包', 'A1000009', '211000009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhq_kjauww7i', '八角', 'A1000010', '211000010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obht_h2jokutu', '川芎', 'A1000011', '211000011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhv_6m5oh45c', '春捲皮', 'A1100001', '211100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obhy_t4h9wuu8', '紅茶包', 'A1100002', '211100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obi0_ueuw897m', '綠茶包', 'A1100003', '211100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obi3_7iyhozwn', '冬瓜糖磚', 'A1100004', '211100004', '塊', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obi6_6as9ukvt', '洋菜粉', 'A1100005', '211100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obi9_pwhmz19d', '山粉圓', 'A1100006', '211100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obic_np9tastx', '麥茶籽', 'A1100007', '211100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obie_gcooz79p', '薏仁', 'A1100008', '211100008', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obih_26mq3ozh', '西谷米', 'A1100009', '211100009', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obij_o3tl2zc8', '麥片', 'A1100010', '211100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obim_wmvn0i13', '紅豆', 'A1100011', '211100011', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obip_q5mgzszm', '綠豆', 'A1100012', '211100012', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obis_k3wkiy6c', '白芝麻', 'A1100013', '211100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obiu_2fgyhlit', '黑芝麻', 'A1100014', '211100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obiw_pcwknikd', '龍眼乾', 'A1100015', '211100015', '盒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obiy_grj4yon5', '蓮子', 'A1100016', '211100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obj0_wmeyaz4u', '粉條', 'A1100017', '211100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obj3_2fwnspvw', '粉皮', 'A1100018', '211100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obj5_mn4tdbss', '鈕扣菇', 'A1100019', '211100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obj7_89z7j3yg', '花生粉', 'A1100020', '211100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obj9_wzdlifvr', '糖粉', 'A1100021', '211100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objb_vbn1ijmf', '黑芝麻粉', 'A1100022', '211100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objd_xvdac8z6', '梅子粉', 'A1100023', '211100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objg_q1vc8a6l', '鍋燒意麵', 'A1100024', '211100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obji_lhxdu285', '米粉', 'A1100025', '211100025', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objl_n1sn8k9y', '冬粉', 'A1100026', '211100026', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objn_8rs0zio4', '白麵線', 'A1100027', '211100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objp_slwwq0lr', '紅麵線', 'A1100028', '211100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objr_xu3hxjam', '營養麵條', 'A1100029', '211100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obju_afnozyx4', '雞絲麵', 'A1100030', '211100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objw_ikudx0wp', '科學麵', 'A1100031', '211100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61objy_st1f9t4q', '肉鬆', 'A1100032', '211100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obk0_ukslkqw6', '新東陽肉鬆', 'A1100033', '211100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obk3_xl77ioc4', '素肉鬆', 'A1100034', '211100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obk5_5to1wgui', '柴魚片', 'A1100035', '211100035', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obk7_vfzhoahc', '麵筋泡', 'A1100036', '211100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obka_winuejza', '紅豆絲', 'A1100037', '211100037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkc_mbdh8tgo', '豆棗', 'A1100038', '211100038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkg_2buzv3x4', '豆鼓', 'A1100039', '211100039', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obki_gi8o7qrq', '乾辣椒/600g', 'A1100040', '211100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkl_j4ggii64', '麵輪', 'A1100041', '211100041', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkp_2n8adj9x', '松子', 'A1100042', '211100042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkr_s8e6yrmr', '豆皮', 'A1100043', '211100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obku_ymobja8o', '油花生', 'A1100044', '211100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkw_4iargla8', '生花生', 'A1100045', '211100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obkz_2eq34g9u', '乾白木耳', 'A1100046', '211100046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obl2_qijpssxx', '乾黑木耳', 'A1100047', '211100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obl4_wkyf78tg', '燕麥', 'A1100048', '211100048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obl7_v8vy6mdp', '乾香菇', 'A1100049', '211100049', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obla_aby2rtzy', '乾香菇絲', 'A1100050', '211100050', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obld_jlcp9825', '海帶芽', 'A1100051', '211100051', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oblf_28lvscnn', '小魚乾', 'A1100052', '211100052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oblj_a06v952x', '蝦皮', 'A1100053', '211100053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oblm_1ve0cx86', '蝦米', 'A1100054', '211100054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oblo_s01w7jqh', '魷魚切絲', 'A1100055', '211100055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obls_u73u9zeq', '洛神', 'A1100056', '211100056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oblv_kd4j4r4e', '乾黑木耳絲', 'A1100057', '211100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obly_h9mqwk0w', '寬冬粉', 'A1100058', '211100058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obm1_gfdqrhl4', '油花生-蒜味', 'A1100059', '211100059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obm4_t7hi4zkl', '肉燥麵-統一', 'A1100060', '211100060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obm6_rqok3mfx', '決明子', 'A1100061', '211100061', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obm9_mar5bofx', '奶茶粉', 'A1100062', '211100062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmc_dj8m9az7', '布丁粉-巧克力', 'A1100063', '211100063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obme_mbvkxbh5', '海苔壽司片', 'A1100064', '211100064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmh_5eh41f0b', '粽葉', 'A1100065', '211100065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmk_8wnflzlc', '滷包', 'A1100066', '211100066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmm_jarfnz3l', '仙草茶包', 'A1100067', '211100067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmp_8n7zmp93', '青草茶包', 'A1100068', '211100068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obms_58md0xyx', '粗鹽', 'A1100069', '211100069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmv_98imbij0', '扁魚', 'A1100070', '211100070', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obmy_ibnvtucl', '醬色', 'A1100071', '211100071', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obn2_km5jah06', '全脂奶粉', 'A1100072', '211100072', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obn5_8l1nrzf9', '腰果', 'A1100073', '211100073', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obn8_eb7q284g', '義大利麵', 'A1100074', '211100074', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnb_c9wqkaga', '黑豆', 'A1100075', '211100075', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obne_0845i31x', '三花奶水', 'A1100076', '211100076', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnh_h5oqxch6', '乾魷魚', 'A1100077', '211100077', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnj_9s7zp8yg', '甜酒豆腐乳(大)/900g', 'A1100078', '211100078', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnm_6wtw4tih', '米豆醬', 'A1100079', '211100079', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnp_x8zuegw5', '脆梅', 'A1100080', '211100080', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obns_28z84sk9', '綠豆仁', 'A1100081', '211100081', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnv_ao3ikt1e', '話梅', 'A1100082', '211100082', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obnx_lwtfsmq9', '紫菜', 'A1100083', '211100083', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obo0_z0w3rrqj', '銀杏', 'A1100084', '211100084', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obo2_mbk1z9de', '麥芽糖', 'A1100085', '211100085', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obo5_kojpptzs', '雞蛋麵', 'A1100086', '211100086', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obo7_dxzt2dqy', '統一肉燥麵', 'A1100087', '211100087', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oboa_s0y21qpg', '統一肉骨茶麵', 'A1100088', '211100088', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obod_r1c6183b', '統一鮮蝦麵', 'A1100089', '211100089', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obof_q06tsz6n', '乾金針花', 'A1100090', '211100090', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oboi_4a5wtr8u', '統一牛肉麵', 'A1100091', '211100091', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obok_37hf56fp', '營養口糧', 'A1100092', '211100092', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obom_3yi8q00c', '焦糖葵花子', 'A1100093', '211100093', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oboo_8fysyjv0', '義大利香料', 'A1100094', '211100094', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obor_3e39i9gj', '螺璇義大利麵', 'A1100095', '211100095', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obot_y0rw1zi6', '關廟麵', 'A1100096', '211100096', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obox_ybdjlvvt', '三合一麥片', 'A1100097', '211100097', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oboz_w3wt062b', '海苔肉鬆', 'A1100098', '211100098', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obp1_6ysnf6q5', '夾心酥', 'B0100001', '220100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obp3_1922muoh', '蘇打餅乾', 'B0100002', '220100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obp6_wiqpvpd3', '海苔餅乾', 'B0100003', '220100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpa_36u89bop', '玉米脆片', 'B0100004', '220100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpc_fsq0f3c5', '沙琪瑪', 'B0100005', '220100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpf_vqz7ffyw', '夾心餅乾', 'B0100006', '220100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obph_1jgnlc6k', '月餅', 'B0100007', '220100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpk_t94mfmfr', '牛蒡絲(原味)', 'B0100008', '220100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpm_jkfdjmec', '牛蒡絲(芥末)', 'B0100009', '220100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpp_xdp8pbg1', '牛蒡絲(焦糖)', 'B0100010', '220100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpr_f41snvqi', '牛蒡絲(海苔)', 'B0100011', '220100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpu_qdiyljea', '牛蒡絲(椒麻)', 'B0100012', '220100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpw_yy6fqwk2', '牛蒡絲(原味)-大', 'B0100013', '220100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obpz_vlo43bgc', '牛蒡絲(芥末)-大', 'B0100014', '220100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obq2_ylp21zpx', '牛蒡絲(焦糖)-大', 'B0100015', '220100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obq7_0a78xebv', '牛蒡絲(海苔)-大', 'B0100016', '220100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obq9_uvsnzbtt', '牛蒡絲(椒麻)-大', 'B0100017', '220100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqc_3ovy74yb', '牛軋餅-原味', 'B0100018', '220100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqe_lmrj7mg6', '牛軋餅-青蔥', 'B0100019', '220100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqh_62u67p2r', '牛蒡絲(洛神梅)-大', 'B0100020', '220100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqk_kru85x5k', '牛蒡絲(薄鹽)-大', 'B0100021', '220100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqm_ik33en1q', '蔬菜餅乾', 'B0100022', '220100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqp_s49cm82s', '雪Q餅-盒裝', NULL, '220100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqr_6aq1hmv4', '虎呷蛋捲-黑糖', 'B0100024', '220100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqu_26knmre1', '虎呷蛋捲-紅茶', 'B0100025', '220100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obqy_7v7qssiu', '牛蒡絲(咖哩)', 'B0100026', '220100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obr1_gws14agr', '牛蒡絲(紫蘇梅)-大', 'B0100027', '220100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obr4_dlppgrly', '養樂多鮮豆漿', 'B0200001', '220200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obr6_23fyp0u2', '光泉黑豆漿', 'B0200002', '220200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obr8_obdopxdc', '陽光黑豆乳', 'B0200003', '220200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obra_e2eyzwd1', '陽光黃豆乳', 'B0200004', '220200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obrd_10qu9vg8', '乳酸飲料', 'B0200005', '220200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obrg_fhx9cdgh', '優酪乳 1L', 'B0200006', '220200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obrj_rmlkywhk', '優酪乳 2L', 'B0200007', '220200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obrl_lvumgnl2', '全脂鮮奶125cc', 'B0200008', '220200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obro_6vsdhhmo', '全脂鮮奶1L', 'B0200009', '220200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obrq_s6ahhung', '全脂鮮奶2L', 'B0200010', '220200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obrv_pga3t9vz', '低脂鮮奶1L', 'B0200011', '220200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obry_iqx254r0', '低脂鮮奶2L', 'B0200012', '220200012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obs1_x9ot2hf8', '全脂保久乳', 'B0200013', '220200013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obs4_6hnmljbp', '低脂保久乳', 'B0200014', '220200014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obs7_7hi1xj2s', '巧克力調味乳', 'B0200015', '220200015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsb_c2s0l7uj', '蘋果調味乳', 'B0200016', '220200016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsd_3rbwpne4', '米漿/1L', 'B0200017', '220200017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsg_h8e8ahqp', '米漿/2L', 'B0200018', '220200018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsj_6ew3ymqy', '豆漿/1L', 'B0200019', '220200019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obso_pz7d02ty', '豆漿/2L', 'B0200020', '220200020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsr_av0xcbk0', '豆奶/1L', 'B0200021', '220200021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsu_kzrww4sb', '豆奶/2L', 'B0200022', '220200022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsw_ts1hyw0a', '糙米漿/1L', 'B0200023', '220200023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obsz_q600y2qp', '調味乳', 'B0200024', '220200024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obt2_n38ztlsr', '麥芽調味乳', 'B0200025', '220200025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obt5_vqgld7xf', '養樂多', 'B0200026', '220200026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obt8_8w6jpqc7', '生活紅茶-利樂包', 'B0200027', '220200027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtb_p05wvrx5', '生活綠茶-利樂包', 'B0200028', '220200028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtd_1no9xjja', '麥茶', 'B0200029', '220200029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtg_qr6b3qp3', '舒跑-利樂包', 'B0200030', '220200030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtj_7vus89pa', '可口可樂/2L', 'B0200031', '220200031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtm_f04laz2l', '可口可樂/1L', 'B0200032', '220200032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtp_ri9d0622', '可口可樂/330cc', 'B0200033', '220200033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obts_3yi51ka5', '柳橙汁-香吉士', 'B0200034', '220200034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtu_2d27hy8j', '礦泉水/1500ml', 'B0200035', '220200035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obtw_izjggjyn', '波蜜果菜汁-利樂包', 'B0200036', '220200036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obty_79lfwrkj', '紙裝果菜汁', 'B0200037', '220200037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obu1_w614l8f2', '紙裝蔓越莓汁', 'B0200038', '220200038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obu3_sav2bol7', '紙裝柳橙汁', 'B0200039', '220200039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obu5_g1x015m8', '紙裝芭樂汁', 'B0200040', '220200040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obu7_jbzmsc6q', '永和豆漿/4.5L', 'B0200041', '220200041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obua_gavuz1f4', '芭樂汁-香吉士', 'B0200042', '220200042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obud_m3lftpzi', '豆漿-利樂包', 'B0200043', '220200043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obuf_ype3w1wh', '米漿-利樂包', 'B0200044', '220200044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obui_93yp0ztm', '麥茶-利樂包', 'B0200045', '220200045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obum_2avq2vg7', '小布丁', 'B0200046', '220200046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obuo_wtk8o26p', '大布丁', 'B0200047', '220200047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obuq_a6wcn7gz', '果凍', 'B0200048', '220200048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obut_2atl79au', '中華豆花(水果)', 'B0200049', '220200049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obuv_lm2do7mn', '中華豆花(花生)', 'B0200050', '220200050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obv0_7w7xsik3', '礦泉水/600ml', 'B0200051', '220200051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obv3_mo5nstqr', '礦泉水/350ml', 'B0200052', '220200052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obv6_eljiecrj', '中華愛玉', 'B0200053', '220200053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obv9_g3q7cg1v', '大湖愛玉凍', 'B0200054', '220200054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvc_xpucpdb0', '豆漿/1.5L', 'B0200055', '220200055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obve_v48cxb2r', '茶花茶', 'B0200056', '220200056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvh_c4b0u8eq', '蔓越莓', 'B0200057', '220200057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvj_5lz7z050', '產銷履歷豆奶', 'B0200058', '220200058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvl_lx0xivlk', '陽光樂豆乳', 'B0200059', '220200059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvn_e4kg5nuz', '冰塊', 'B0210001', '220210001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvp_ta8l8wzt', '香草冰淇淋', 'B0210002', '220210002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvs_v5omvp5n', '烤肉刷', 'C0100001', '230100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvu_d4punckr', '烤肉架', 'C0100002', '230100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvx_15iklayv', '烤肉網', 'C0100003', '230100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obvz_q0u1dr7l', '薄板', 'C0100004', '230100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obw2_ksiajjjg', '木炭', 'C0100005', '230100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obw4_plbjg0fa', '火種', 'C0100006', '230100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obw7_ppz1u2a5', '菜刀', 'C0100007', '230100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obw9_8i91azpz', '水果刀', 'C0100008', '230100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwb_6s8lyggo', '刮皮刀', 'C0100009', '230100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwe_mkocui92', '香蕉刀', 'C0100010', '230100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwg_n9l6d9n1', '剪刀', 'C0100011', '230100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwj_q1sjjnjk', '開罐器', 'C0100012', '230100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwm_wmqpce4q', '粘板', 'C0100013', '230100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwp_my9ws1rc', '飯巾', 'C0100014', '230100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obws_4wfysmlk', '飯匙', 'C0100015', '230100015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwv_1opeud1l', '菜勺(無孔)', 'C0100016', '230100016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obwx_tbeii9uk', '菜勺(有孔)', 'C0100017', '230100017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obx0_4v4drwex', '點火槍', 'C0100018', '230100018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obx2_2hbkjhei', '白鐵水瓢', 'C0100019', '230100019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obx5_cgvitgji', '六格儲運箱(密籃)', 'C0100020', '230100020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obx8_brbksvcg', '六格儲運箱(有孔)', 'C0100021', '230100021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxa_jeitr3xi', '調理盆1/1*15cm', 'C0100022', '230100022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxc_90ckmq0h', '調理盆1/1*6cm', 'C0100023', '230100023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxf_2gpl1fuk', '調理盆1/1*2cm 沖孔', 'C0100024', '230100024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxh_g4fo701z', '調理盆1/1*6cm 沖孔', 'C0100025', '230100025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxk_5nq1jv7v', '調理盆1/1*10cm 沖孔', 'C0100026', '230100026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxn_rcxsmqrm', '調理盆1/1 凹蓋', 'C0100027', '230100027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxp_mrnrz9wq', '調理盆1/2 *15cm', 'C0100028', '230100028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxr_hk2g4wyq', '調理盆1/2 凹蓋', 'C0100029', '230100029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxu_5znr126r', '調理盆1/3*15cm', 'C0100030', '230100030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxw_yibnv8it', '調理盆1/3蓋', 'C0100031', '230100031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obxz_dwt6lhii', '調理盆1/4*15cm', 'C0100032', '230100032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oby2_oae6km91', '調理盆1/4蓋', 'C0100033', '230100033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oby4_x75g7oow', '調理盆1/6*15cm', 'C0100034', '230100034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oby6_q8k4vuj5', '調理盆1/6 蓋', 'C0100035', '230100035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oby8_43852ai7', '一體湯桶(單層蓋)26*26cm', 'C0100036', '230100036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obya_50o2layq', '一體湯桶(單層蓋)30*30cm', 'C0100037', '230100037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyc_iqhkgqgk', '密封桶-大', 'C0100038', '230100038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyf_9k74pbk7', '塑膠籃1/1調理盆59*35.5*17.5cm', 'C0100039', '230100039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyj_ogbigzxj', '菜箱1/2獨立蓋', 'C0100040', '230100040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obym_sp92k674', '萬能箱50*37*14.7cm', 'C0100041', '230100041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyq_cpkgabsl', '日式保溫飯箱50*37*14.7cm', 'C0100042', '230100042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyt_2wyu4wsk', '方型飯箱2格43*32*13cm', 'C0100043', '230100043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyw_rai8gu4n', '菜箱1/2獨立盆22*32*12cm', 'C0100044', '230100044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obyz_ak6hudh4', '不鏽鋼蓋49.5*35.5*2.5cm', 'C0100045', '230100045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obz1_3grfa51j', '烏龜車', 'C0100046', '230100046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obz3_aide3h7m', '兩輪手推車', 'C0100047', '230100047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obz6_4lqlr6gc', '工業電扇18"', 'C0100048', '230100048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obz9_t1l6p0n9', '水槽濾水籃', 'C0100049', '230100049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzb_cz39wdu2', '水槽濾水塞蓋(橡皮+白鐵蓋)', 'C0100050', '230100050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obze_iw6knp5n', '茶壺', 'C0100052', '230100052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzg_55ov10kv', '氣壓式噴水壺', 'C0100053', '230100053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzj_zeh90fr5', '酒精測溫機', 'C0100054', '230100054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzl_oaeu1k51', '鎖頭', 'C0100055', '230100055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzn_ydtsw91m', '烤肉組合$2000', 'C0100056', '230100056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzp_e5i67dnh', '空籃-松富1號', 'C0100057', '230100057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzs_a29j3n2o', '空籃-松富2號', 'C0100058', '230100058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzv_lahzjzgm', '空籃-松富3號', 'C0100059', '230100059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61obzy_2jo1cfxf', '空籃-松富5號', 'C0100060', '230100060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc01_nx9oktg2', '空籃-松富6號', 'C0100061', '230100061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc04_a2nv446l', '空籃-松富7號', 'C0100062', '230100062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc07_yd5isw0a', '空籃-松富8號', 'C0100063', '230100063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0a_46cxbj6v', '空籃-松富9號', 'C0100064', '230100064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0c_e6lza89n', '四角方籃', 'C0100065', '230100065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0e_xuum4w0r', 'PE袋 半斤', 'C0200001', '230200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0h_4nice7td', 'PE袋(1斤)', 'C0200002', '230200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0k_3rp6iipw', 'PE袋(2斤)', 'C0200003', '230200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0o_v4l8kte4', 'PE袋(3斤)', 'C0200004', '230200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0r_39yqsnse', 'PE袋 5斤', 'C0200005', '230200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0u_j6b83ltm', 'PE袋 10斤', 'C0200006', '230200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc0x_a9a8k8je', 'PE袋 5*7', 'C0200007', '230200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc10_dwo464ki', 'PE袋 6*8', 'C0200008', '230200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc13_cgmfnkji', 'PE袋 7*10', 'C0200009', '230200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc16_hirjv2e9', 'PE袋 8*12', 'C0200010', '230200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc19_m6tz0rrl', '超薄袋半斤', 'C0200011', '230200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1c_dfql1k6z', '超薄袋1斤', 'C0200012', '230200012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1f_qor6nuu8', '超薄袋2斤', 'C0200013', '230200013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1h_qisrqbk3', '超薄袋3斤', 'C0200014', '230200014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1l_yh9dryua', '超薄袋5斤', 'C0200015', '230200015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1n_daucctra', '超薄袋10斤', 'C0200016', '230200016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1q_28oinu7c', '超薄袋5.5*6', 'C0200017', '230200017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1t_3mfqpy0z', '超薄袋 5*7', 'C0200018', '230200018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc1w_agdx1p7i', '超薄袋 6*8', 'C0200019', '230200019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc20_p1qcnvto', '超薄袋20斤', 'C0200020', '230200020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc23_xcbb5edn', '花袋半斤', 'C0200021', '230200021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc26_0f4zegl7', '花袋1斤', 'C0200022', '230200022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc29_qfagslgx', '花袋2斤', 'C0200023', '230200023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2c_x5tqbapj', '花袋3斤', 'C0200024', '230200024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2e_w1ogqofu', '花袋4斤', 'C0200025', '230200025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2h_1mfa29za', '花袋5斤', 'C0200026', '230200026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2k_fleqxlwt', '花袋7斤', 'C0200027', '230200027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2n_0pgfoowa', '花袋10斤', 'C0200028', '230200028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2q_q3zekc05', '花袋20斤', 'C0200029', '230200029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2t_8vl71yys', '夾鏈袋3號', 'C0200030', '230200030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2v_20aqzk6c', '夾鏈袋6號', 'C0200031', '230200031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc2x_29h1x2fw', '夾鏈袋9號', 'C0200032', '230200032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc30_ikjncpgi', '夾鏈袋10號', 'C0200033', '230200033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc33_rb44wwx2', '豆漿袋', 'C0200034', '230200034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc35_eq6lmc1k', '保鮮膜', 'C0200035', '230200035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc38_83dg0uru', '橡皮筋', 'C0200036', '230200036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3b_6dwlk1ca', '紙湯杯260CC', NULL, '230200037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3e_n7vrddwl', '紙湯蓋260CC', NULL, '230200038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3g_a1zywncv', '紙湯杯390CC', NULL, '230200039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3j_om4wju8a', '紙湯蓋390CC', 'C0200040', '230200040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3l_d05c1oqa', '紙湯杯520CC', NULL, '230200041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3n_mh0rgcmp', '紙湯蓋520CC', 'C0200042', '230200042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3q_8is78ed8', '紙湯杯750CC', 'C0200043', '230200043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3s_8njp4de9', '紙湯蓋750CC', 'C0200044', '230200044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3u_2udso88b', '紙湯杯850CC', 'C0200045', '230200045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3x_o2by8sb3', '紙湯蓋850CC', 'C0200046', '230200046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc3z_yda7mqm9', '白膠杯-170cc', 'C0200047', '230200047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc41_wgllbjbt', '一體小便當盒', 'C0200048', '230200048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc43_fedeuakg', '一體大便當盒', 'C0200049', '230200049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc46_u0hj92x6', '大四格+蓋', 'C0200050', '230200050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc48_jfr4371p', '左右四格便當盒', 'C0200051', '230200051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4b_e4bmvk9b', '上下四格便當盒', 'C0200052', '230200052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4e_z6vh8pz9', '上下五格便當盒', 'C0200053', '230200053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4g_p040k0ax', '一體特中便當盒', 'C0200054', '230200054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4i_vg23h70g', '一體中便當盒', 'C0200055', '230200055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4l_gj86vrxz', '紙漢堡盒', 'C0200056', '230200056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4n_wuq6og2j', '日式便當盒', 'C0200057', '230200057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4q_gtxoaowo', '沙拉麵包盒L-018(苜蓿芽透明包裝盒)', 'C0200058', '230200058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4t_zpw43lkh', '紙餐盤', 'C0200059', '230200059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4v_b19rgif5', '中秋禮 (贈)', 'C0200060', '230200060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc4y_usc9ryhd', '塑膠湯匙', 'C0200061', '230200061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc50_m8socsoj', '夾子', 'C0200062', '230200062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc52_2p7ccrgr', '衛生筷', 'C0200063', '230200063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc54_dthmdqfm', '紙湯碗', 'C0200064', '230200064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc57_rl0vo92u', '餐巾紙紅色', 'C0200065', '230200065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5a_ush9zs4n', '餐巾紙白色', 'C0200066', '230200066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5c_08lfseb9', '年糕紙', 'C0200067', '230200067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5g_oxne03sn', '飲料杯360CC', 'C0200068', '230200068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5i_luulzu4h', '衛生筷(紙裝)', 'C0200069', '230200069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5l_u9v4a7ry', '黑色雙格餐盒', NULL, '230200070', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5o_ysv4hsdh', '透明餐盒蓋', NULL, '230200071', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5r_ilr3bozn', '稻穀筷', 'C0200072', '230200072', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5u_gm6h6i0e', '牛皮紙袋(公版)', NULL, '230200073', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5x_et6t3k78', '腰封', NULL, '230200074', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc5z_9kcc08ur', '牛皮紙袋(私版)', NULL, '230200075', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc62_qo8rq8ay', '紙箱B楞-空白', 'C0200076', '230200076', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc65_vforg79n', '鋁箔紙', 'C0200077', '230200077', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc68_qzxt319t', '水蜜桃禮盒18入', 'C0200078', '230200078', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6a_8r43a8cs', '水蜜桃禮盒16入', 'C0200079', '230200079', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6c_8nttyexu', '麝香葡萄', 'C0200080', '230200080', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6f_pidvdf1g', '貓眼葡萄', 'C0200081', '230200081', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6h_9fvxs5fx', '水梨7入禮盒', 'C0200082', '230200082', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6k_qd09unt6', '水梨8入禮盒', 'C0200083', '230200083', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6n_2c218zkw', '哈密瓜禮盒', 'C0200084', '230200084', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6q_sqftjtjz', '櫻桃禮盒', 'C0200085', '230200085', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6t_is8ura0g', '奇異果禮盒', 'C0200086', '230200086', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc6w_8qluypbf', '櫻桃蘋果', 'C0200087', '230200087', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc70_jnipu8f0', '砂糖橘', 'C0200088', '230200088', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc73_ds5zxujx', '恐龍蛋禮盒', 'C0200089', '230200089', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc76_4gn89lxy', '蛋盒', 'C0200090', '230200090', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc79_c7rm959w', '美生菜袋子', 'C0200091', '230200091', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7b_n5bfvbt7', '藍莓', 'C0200092', '230200092', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7e_sqxf1694', '超薄袋15斤', 'C0200093', '230200093', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7h_wsghlz5z', '紙箱B楞-空白125cm', 'C0200094', '230200094', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7j_t2o5j6r9', '紙箱B楞-空白100cm', 'C0200095', '230200095', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7m_7fmg0a8n', 'PE手提袋', NULL, '230200096', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7o_4y4qr009', '金虎爺牛蒡絲鋁箔夾鏈立袋60g', 'C0200097', '230200097', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7q_c2nzm66j', '金虎爺牛蒡絲鋁箔夾鏈立袋70g', 'C0200098', '230200098', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7t_fsfb36rc', '龍港源食日式餐盒', 'C0200099', '230200099', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7v_ktnx57a4', 'A款餐盤', 'C0200100', '230200100', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc7z_2kjd22hs', '掃把', 'C0300001', '230300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc81_uw3w9um3', '拖把', 'C0300002', '230300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc84_z9nrjdk5', '地板刷', 'C0300003', '230300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc87_tywwvcb5', '地板刷(柄)', 'C0300004', '230300004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc89_n9ssjl5y', '紅棕地板刷', 'C0300005', '230300005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8c_o2kd96o9', '刮刀膠柄', 'C0300006', '230300006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8f_gbwouvf1', '竹掃把', 'C0300007', '230300007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8i_w7y8ku75', '菜瓜布(紅色)', 'C0300008', '230300008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8k_zik0scii', '菜瓜布(綠色)', 'C0300009', '230300009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8n_nfohs3yb', '菜瓜布-3M', 'C0300010', '230300010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8r_l3myqrzc', '白色抹布', 'C0300011', '230300011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8t_0ctxe80r', '黃色抹布', 'C0300012', '230300012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8w_v1konafy', '籃色抹布', 'C0300013', '230300013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc8z_a62hes70', '垃圾桶大', 'C0300014', '230300014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc92_tzhu6i0v', '垃圾桶中', 'C0300015', '230300015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc96_zgp1uwuf', '垃圾桶小', 'C0300016', '230300016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc98_r3in4hkj', '趕水器', 'C0300017', '230300017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9b_1t4yg8wy', '畚斗', 'C0300018', '230300018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9e_rof1araa', '噴頭-洗車機', 'C0300019', '230300019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9g_ao1zvyjz', '大噴嘴', 'C0300020', '230300020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9i_u652b94s', '洗碗精', 'C0400001', '230400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9k_ay3n153m', '白熊洗碗精', 'C0400002', '230400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9n_b9gomwko', '洗衣粉', 'C0400003', '230400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9q_u2vtu75y', '玻璃清潔劑-有噴頭', 'C0400004', '230400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9t_gvwveha3', '玻璃清潔劑-無噴頭', 'C0400005', '230400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oc9z_f8xwjzcr', '洗潔浴廁劑', 'C0400006', '230400006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oca3_mu8rfsmm', '除油靈', 'C0400007', '230400007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oca5_fhrl103j', '漂白水', 'C0400008', '230400008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocab_kaca15pb', '鹽酸', 'C0400009', '230400009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocad_ymf1bwj8', '鹼片', 'C0400010', '230400010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocag_wo30tr06', '無心垃圾袋(小)', 'C0400011', '230400011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocaj_8rkb3e23', '無心垃圾袋(中)', 'C0400012', '230400012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocam_0ztkbo95', '無心垃圾袋(大)', 'C0400013', '230400013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocao_5ps209o4', '黑色特大垃圾袋', 'C0400014', '230400014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocaq_4hkallpr', '透明特大垃圾袋', 'C0400015', '230400015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocas_86fz7grd', '擦手紙', 'C0400016', '230400016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocav_m509yb55', '抽取式衛生紙', 'C0400017', '230400017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocax_768p70q6', '捲筒衛生紙(大)', 'C0400018', '230400018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocb0_miuq240f', '洗手乳', 'C0400019', '230400019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocb3_364wc92d', '廚房清潔劑-有噴頭', 'C0400020', '230400020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocb6_crkkjx1o', '實心垃圾袋(小)', 'C0400021', '230400021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocb9_nr9nqyb8', '白色超大垃圾袋', 'C0400022', '230400022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbc_uiyc076s', '黏鼠板-大', 'C0400023', '230400023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbf_godwt2tf', '黏鼠板-小', 'C0400024', '230400024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbi_vp30te6c', '恐龍191金屬保護油', 'C0400025', '230400025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbl_4187lcc5', '恐龍192噴霧式黃油', 'C0400026', '230400026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbo_whwg3k8z', '101洗碗精', 'C0400028', '230400028', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbr_i8rjwon1', '白色上衣 S', 'C0600001', '230600001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbu_3hmxy2kv', '白色上衣 M', 'C0600002', '230600002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocbx_f18m4v37', '白色上衣 L', 'C0600003', '230600003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occ0_imrcnsnt', '白色上衣 XL', 'C0600004', '230600004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occ2_pwzvge3q', '白色上衣 2XL', 'C0600005', '230600005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occ4_sn8nw483', '白色上衣 3XL', 'C0600006', '230600006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occ7_y6pzktbh', '白色上衣 5XL', 'C0600007', '230600007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occa_eyi47kjx', '紅色上衣 S', 'C0600008', '230600008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occc_hwm48b7t', '紅色上衣 M', 'C0600009', '230600009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occf_rflzsaz4', '紅色上衣 L', 'C0600010', '230600010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occi_4noyn83y', '紅色上衣 XL', 'C0600011', '230600011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occk_mrzn20a4', '紅色上衣 2XL', 'C0600012', '230600012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occp_d1u9y9q1', '藍色上衣 3XL', 'C0600013', '230600013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occt_35glmsou', '藍色上衣 M', 'C0600014', '230600014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occw_04g0cs2x', '藍色上衣 L', 'C0600015', '230600015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61occz_0c0wsl3y', '藍色上衣 XL', 'C0600016', '230600016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocd2_1g7uj9ww', '藍色上衣 2L', 'C0600017', '230600017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocd4_ape9zxu8', '藍色上衣 5XL', 'C0600018', '230600018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocd6_9klbpa6k', '藍色褲子 S', 'C0600019', '230600019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocd9_ed8h56be', '藍色褲子 M', 'C0600020', '230600020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdd_l30zu3b7', '藍色褲子 L', 'C0600021', '230600021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdg_t8h62yqu', '藍色褲子 XL', 'C0600022', '230600022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdi_x96kp53y', '藍色褲子 2L', 'C0600023', '230600023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdk_uvny59r7', '藍色褲子 3XL', 'C0600024', '230600024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdn_2ko8w58q', '藍色褲子 5L', 'C0600025', '230600025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdq_ybjmh9ow', '黑色褲子 S', 'C0600026', '230600026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdu_3i50dopr', '黑色褲子 M', 'C0600027', '230600027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocdx_t2a9et39', '黑色褲子 L', 'C0600028', '230600028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oce0_2dzznvx4', '黑色褲子 XL', 'C0600029', '230600029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oce3_f1n6oe7f', '黑色褲子 2XL', 'C0600030', '230600030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oce5_s3jtcyx3', '黑色褲子 3XL', 'C0600031', '230600031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oce8_iisyq1oe', '黑色褲子 5L', 'C0600032', '230600032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oceb_6z9jkn4p', '女版雨鞋 9號', 'C0600033', '230600033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oced_xwm99j43', '女版雨鞋 9.5號', 'C0600034', '230600034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocef_yzomcycp', '女版雨鞋 10號', 'C0600035', '230600035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocei_h68pzqmv', '女版雨鞋 10.5號', 'C0600036', '230600036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocel_p049d9ff', '男版雨鞋 10號', 'C0600037', '230600037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocen_ti3txj9g', '男版雨鞋 10.5號', 'C0600038', '230600038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocep_2b1cnzca', '男版雨鞋 11號', 'C0600039', '230600039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oces_3oda24ak', '男版雨鞋 11.5號', 'C0600040', '230600040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocev_fwdejrsr', '男版雨鞋 12號', 'C0600041', '230600041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocey_4wodwtzl', '網帽 M', 'C0600042', '230600042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocf1_kvsk2n2f', '網帽 L', 'C0600043', '230600043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocf5_b6agu1el', '司機藍色帽子', 'C0600044', '230600044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocf8_m2c1k1p7', '塑膠手套 7.5號', 'C0600045', '230600045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfb_ta9y2gv6', '塑膠手套 8號', 'C0600046', '230600046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfd_lke4fwnv', '塑膠手套 8.5號', 'C0600047', '230600047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfh_uvv1yepv', '手扒雞手套', 'C0600048', '230600048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfj_6oldd91y', '棉紗手套', 'C0600049', '230600049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfn_g7bpkh12', '廚工圍裙', 'C0600050', '230600050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfp_0cob794p', '學生圍裙', 'C0600051', '230600051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfs_im9e4qe4', '布口罩', 'C0600052', '230600052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfv_5injwkvj', '紙口罩', 'C0600053', '230600053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocfx_28qx5zhg', '防滑手套', 'C0600054', '230600054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocg0_mudp7e7b', '白色褲子 S', 'C0600055', '230600055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocg3_2ekchcua', '白色褲子 M', 'C0600056', '230600056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocg6_0fhzle07', '白色褲子 XL', 'C0600057', '230600057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocg9_xvltws7v', '白色褲子 2L', 'C0600058', '230600058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgc_uvjqevel', '白色褲子 3L', 'C0600059', '230600059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocge_oajngd6l', '白色褲子 4L', 'C0600060', '230600060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgi_d1lyh5j8', '廚師服 M', 'C0600061', '230600061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgl_q0d35yyj', '廚師服 L', 'C0600062', '230600062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgo_aknr5otq', '廚師服 XL', 'C0600063', '230600063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgq_k56bi9hr', '廚師服 XXL', 'C0600064', '230600064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgt_e37cpx77', '鋪棉外套(紅色)S', 'C0600065', '230600065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgv_2t9jtktg', 'PV無粉手套', 'C0600066', '230600066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocgy_kx9b8l2e', '鋪棉外套(紅色)M', 'C0600067', '230600067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61och1_9wu7cum8', '鋪棉外套(紅色)L', 'C0600068', '230600068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61och2_99g34gl3', '鋪棉外套(紅色)3XL', 'C0600069', '230600069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61och5_z29g5x9v', '藍色褲子2XL', 'C0600070', '230600070', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61och8_t0e85crn', '藍色褲子4XL', 'C0600071', '230600071', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocha_wyfxtvlz', '藍色褲子5XL', 'C0600072', '230600072', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochd_85iegg8d', '白色上衣4XL', 'C0600073', '230600073', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochh_dddcxz2l', '足勇足讚事務剪刀', 'C0700001', '230700001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochj_4gnfblyc', '凱旋磁條/4入30M', 'C0700002', '230700002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochm_ap62f6ka', '修正帶', 'C0700003', '230700003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocht_u3g0pxbn', '美工刀補充片', 'C0700006', '230700006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochw_qqsthqt7', 'A5大格線內紙/20孔', 'C0700007', '230700007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochz_tddtyb4h', 'A5窄橫線內線/20孔', 'C0700008', '230700008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oci5_xvxp6xyo', '圓形紙夾/3', 'C0700010', '230700010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oci7_4gxyhmzx', '雜誌架/開放式', 'C0700011', '230700011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oci9_hl8zr4eu', '足勇雙孔打孔機', 'C0700012', '230700012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocic_01ws9q04', '原子筆/0.7藍OB-100', 'C0700013', '230700013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocie_ioehnxpf', '抽取式螢光五色條/45*12', 'C0700014', '230700014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocig_dbayzezu', '小牛皮信封', 'C0700015', '230700015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocij_f25u8dbb', 'PP彈簧夾紅210', 'C0700016', '230700016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocim_id0z6o2q', 'CAIO計算機/AX-120ST', 'C0700017', '230700017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocio_4anlno2w', '瑩光筆可擦/粉', 'C0700018', '230700018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocir_9kroq6v0', '足勇迴紋針/特大', 'C0700019', '230700019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocit_pf0nhs9w', 'HFP風琴夾', 'C0700020', '230700020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ociw_u6s3094m', '無暇2孔夾/黑', 'C0700021', '230700021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ociy_whcm6cur', '雲彩紙A4/09', 'C0700022', '230700022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocj1_0d2jy1sp', '釘書針', 'C0700023', '230700023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocj3_x2c2cwtf', 'CAIO計算機', 'C0700024', '230700024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocja_vlfg7wnj', '抽屜整理盒', 'C0700025', '230700025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjd_vg2fxw2p', '雄獅奇異筆/黑200', 'C0700026', '230700026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjg_f62kvhr1', '3M白板清潔劑', 'C0700027', '230700027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjj_65xycfif', '足勇三角迴紋針', 'C0700028', '230700028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjm_sb8xrrtz', '吉米大B綜合籃', 'C0700030', '230700030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjp_5493a66r', '書架', 'C0700031', '230700031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjs_76mlf0bk', '彩色長尾夾', 'C0700032', '230700032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocju_wd61ci2p', '凱旋磁條/2入30M', 'C0700034', '230700034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocjx_2dsircbb', '方形強力磁夾', 'C0700035', '230700035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ock0_n93ioaic', '錢幣整理盒/聯盒', 'C0700038', '230700038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ock3_dijurtz6', '輕便收納袋', 'C0700039', '230700039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ock6_ctfzfgpf', '丹迪紙', 'C0700040', '230700040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ock8_5u89b9k1', '直式付繩公文袋', 'C0700041', '230700041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockb_81qtdy34', '彩紙', 'C0700042', '230700042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockd_fom9m9d8', '開放式雜誌夾', 'C0700043', '230700043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockg_3euity5f', '維修費', 'C0700044', '230700044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockj_dkbsf571', '筆袋文具組', 'C0700045', '230700045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockl_9nbej33w', '卡通筆記22k', 'C0700046', '230700046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocko_rk6xwag3', '相本', 'C0700047', '230700047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockr_6h6vzt8c', '手作之夾', 'C0700048', '230700048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocku_n2n00xya', '楓葉彈蓋曲線暢快瓶', 'C0700049', '230700049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockw_d9py9i5c', '魔術水壺', 'C0700050', '230700050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ockz_6ibpooo5', '資料夾', 'C0700051', '230700051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocl2_d2nqm0am', '柴油', 'C0700052', '230700052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocl5_877qkx01', '自動原字筆', 'C0700053', '230700053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocl9_ogmtlu2d', '透明膠帶', 'C0700055', '230700055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oclb_qa6e38kf', '電腦主機', 'C0700056', '230700056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oclf_3h4qbj6w', '報表紙80行3P', 'C0700057', '230700057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocli_8q33twz7', '報表紙80行2P', 'C0700058', '230700058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocll_51zc0f41', '軟體費用', 'C0700059', '230700059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oclo_zybfbf6m', '汽車保險費', 'C0700060', '230700060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oclr_58o9duh3', '租金支出', 'C0700061', '230700061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oclu_1oedg7zg', '環境除蟲消毒', 'C0700062', '230700062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oclx_0t2sqjo5', '酵素', 'C0800001', '230800001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocm0_g5hyhnwg', '呈色劑', 'C0800002', '230800002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocm3_rnc8ggh4', '基質', 'C0800003', '230800003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocm6_4m2q41dn', '緩衝液', 'C0800004', '230800004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocm9_83g1a3li', '溴水安瓶(1ml)', 'C0800005', '230800005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmc_hqzmb5hh', '自動吸管固定式 1ml', 'C0800006', '230800006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmf_wg59fs0e', '自動吸管固定式 100μl', 'C0800007', '230800007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmi_9t1h80zn', '自動吸管固定式 20μl', 'C0800008', '230800008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmk_zhtm3qyp', '自動吸管可調式 0.5~5ml', 'C0800009', '230800009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oci2_rhkrfeng', '26孔內頁/100入', 'C0700009', '230700009', '個', 0, '2026-02-28 08:49:40.634827+00');
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocho_3wlu6o3r', '40元手牌美工刀/小', 'C0700004', '230700004', '個', 0, '2026-02-28 08:49:43.385874+00');
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmn_96g2tfcm', '吸管套 5ml', 'C0800010', '230800010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmp_dghzs8bd', '吸管套  1ml', 'C0800011', '230800011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocms_zfdrn3o3', '吸管套 20μl', 'C0800012', '230800012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmv_ua43jg5m', '石腊膜', 'C0800013', '230800013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocmx_b9ozb7ws', '塑膠比色管', 'C0800014', '230800014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocn0_k3mnygra', '3M大腸桿菌群快篩片', 'C0800015', '230800015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocn2_vqoz5o3y', '3M總生菌數群快篩片', 'C0800016', '230800016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocn4_elwz5ig7', '午餐製作費', 'C1111111', '231111111', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocn7_4xrpzaxe', '贈予總數', 'C1111113', '231111113', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocn9_xpzfukop', '午餐製作費-新生國中', 'C1111114', '231111114', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnc_gaq6zhkz', '午餐製作費-東海國中', 'C1111115', '231111115', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnf_gsdtmn8d', '午餐製作費-寶桑國中', 'C1111116', '231111116', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnh_3p1kapfd', '午餐製作費-中廚', 'C1111117', '231111117', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnj_07hpmw6d', '早餐製作費', 'C1111118', '231111118', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnm_s3gbn53k', '晚餐製作費', 'C1111119', '231111119', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocno_9qolb1a7', '早餐製作費-桃源國中', 'C1111120', '231111120', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnq_f3inux7x', '晚餐製作費-桃源國中', 'C1111121', '231111121', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnt_a29qmg82', '幼兒園早點食材', 'C1111122', '231111122', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnv_83pktgcp', '幼兒園午點食材', 'C1111123', '231111123', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnx_czk99ybu', '午餐精進費', 'C1111124', '231111124', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocnz_ke45o2lw', '護家早餐餐數', 'C1111151', '231111151', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oco2_cgk2sbcs', '護家午餐餐數', 'C1111152', '231111152', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oco4_jdc7dbzr', '護家午點餐數', 'C1111153', '231111153', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oco7_x568qome', '護家晚餐餐數', 'C1111154', '231111154', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oco9_0iae7jdt', '醫院餐費', 'C1111161', '231111161', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocob_pj21onbr', '普通飲食', 'C1111162', '231111162', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocod_8ven6y4s', '治療飲食', 'C1111163', '231111163', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocof_ef662l81', '榮民飲食', 'C1111164', '231111164', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocoi_agp11i2n', '健保灌食', 'C1111165', '231111165', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocok_kjbxg89h', '洗腎餐', 'C1111166', '231111166', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocom_3n9c7t1b', '便當', 'C1111167', '231111167', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocop_atlsgam6', '餐廳餐飲', 'C1111168', '231111168', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocor_4sc97hhk', '其他餐飲', 'C1111171', '231111171', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocov_p29dmrgl', '運費收入', 'C1111172', '231111172', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocoy_61pns722', '租金收入', 'C1111173', '231111173', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocp1_8kihoxpt', '其他收入', 'C1111179', '231111179', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocp4_0xpgon3x', '餐點製作費', 'C1111181', '231111181', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocp7_ti7mndjm', '餐點食材費', 'C1111182', '231111182', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocp9_90nkobda', '另購食材', 'C1111183', '231111183', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpb_37dlk1bh', '運費補助', 'C1111191', '231111191', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpd_bpl5nfvj', '薪資補助', 'C1111192', '231111192', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpg_luihn5sg', '有機菜製作費', 'C1111193', '231111193', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpj_b7zqu0xy', '鮮奶1L', 'C9000001', '239000001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpl_r9n33y6s', '優格', 'C9000002', '239000002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpo_21zdfy5l', '蜂蜜', 'C9000003', '239000003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpr_m10j1cr0', '牛臀肉', 'C9000004', '239000004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpu_lcgiokvz', '牛骨', 'C9000005', '239000005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocpx_pqqnsg34', '綜合香料', 'C9000006', '239000006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocq0_hhwz1dqy', '月桂葉', 'C9000007', '239000007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocq3_js87c8em', '肉桂粉', 'C9000008', '239000008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocq6_23x6z4y3', '匈牙利紅椒粉', 'C9000009', '239000009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocq9_e53yreb8', '蕃茄糊', 'C9000010', '239000010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqc_34oz0vuv', '蕃茄粒罐頭', 'C9000011', '239000011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqe_mvbsfzh9', '香草精', 'C9000012', '239000012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqh_2rvawv2w', '紅葡萄酒', 'C9000013', '239000013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqk_n1t4kj3v', '白葡萄酒', 'C9000014', '239000014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqn_1cxxaaaa', '麻油猴頭菇', 'C9000015', '239000015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqq_kygmv91h', '白胡椒粉(小罐)', 'C9000016', '239000016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqs_b3yihckh', '酸奶油', 'C9000017', '239000017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqv_9y0vbs8w', '辣根醬', 'C9000018', '239000018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocqy_uz9mduya', '法式芥末醬', 'C9000019', '239000019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocr0_0twlfrjo', '壽司米', 'C9000020', '239000020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocr3_63ml0wmr', '蒲燒雕魚', 'C9000021', '239000021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocr7_umi5yeap', '巴西里葉', 'C9000022', '239000022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocra_5n82fg5z', '豆蔻粉', 'C9000023', '239000023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocrd_50ef9eax', '玫瑰鹽', 'C9000024', '239000024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocrg_xvq4i5b6', '迷迭香葉', 'C9000025', '239000025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocri_vf6fhh5v', '百里香葉', 'C9000026', '239000026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocrl_b2io0293', '義大利通心麵', 'C9000027', '239000027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocro_a5uncfgo', '黃芥末', 'C9000028', '239000028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocrq_cdtmy2w8', '蒙特婁牛排香料', 'C9000029', '239000029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocru_rqef5npy', '檢驗費', 'C9900001', '239900001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocrx_q8330zqp', '其他類', 'C9900002', '239900002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocs0_ygma5m4m', '差額', 'C9900003', '239900003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocs3_ay5o5ipi', '折扣金額', 'C9900004', '239900004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocs8_92ue5gev', '以件計費', 'C9900005', '239900005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsb_aev87kbq', '以公斤計費', 'C9900006', '239900006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocse_6zt44egf', '運費自付(公斤)', 'C9900007', '239900007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsh_myx4whpm', '運費自付(件數)', 'C9900008', '239900008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsj_vvhclenj', '對方付費(公斤)', 'C9900009', '239900009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsm_6mkalo7k', '對方付費(件數)', 'C9900010', '239900010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsp_8uc6bb2w', '進貨折讓', 'C9900011', '239900011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocss_p028kks3', '銷貨折扣', 'C9900012', '239900012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsv_80tqxemu', '管理費', 'C9900013', '239900013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocsy_lu7tg8se', '綠島小運費', 'C9900014', '239900014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oct1_lg962m05', '綠島飯店運費', 'C9900015', '239900015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oct5_u041ljpz', '蘭嶼學校運費', 'C9900016', '239900016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oct8_aw9qld5i', '口罩運費', 'C9900017', '239900017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octc_izclanfx', '蔬菜箱-300元', 'C9900018', '239900018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octg_qogmmkcr', '蔬菜箱-500元', 'C9900019', '239900019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octi_k2fwyfci', '就業安定費', 'C9900020', '239900020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octl_zvfagz9q', '稅捐', 'C9900021', '239900021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octo_syif0kk2', '常溫運費(小)-120元', 'C9900022', '239900022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octs_c30vyv4i', '常溫運費(大)-135元', 'C9900023', '239900023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61octw_j1mqfjcf', '保險費', 'C9900024', '239900024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocu0_fq9sa7gw', '常溫運費-120元', 'C9900025', '239900025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocu3_oqmwbnkn', '冷藏凍運費(小)-200元', 'C9900026', '239900026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocu6_j6dizxyy', '冷藏凍運費(大)-250元', 'C9900027', '239900027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocu9_nolol2ne', '金虎爺帆布托特包', 'C9900028', '239900028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocuc_8q3ajfw8', '超商運費', 'C9900029', '239900029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocuf_i8yox5ix', '貨到付款手續費', 'C9900030', '239900030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocui_h126olxs', '台東專科食材', 'C9999997', '239999997', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocul_eqinsb27', '蔬菜一批', 'C9999998', '239999998', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocuo_k7tw0hpd', '人蔘葉', 'C9999999', '239999999', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocur_ei024hkx', '愛美力涵纖1.2  250ML', 'E0100001', '250100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocut_ey02wy3x', '葡勝納嚴選250ml', 'E0100002', '250100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocuw_m3z0t4cq', '愛美力 8 OZ', 'E0100003', '250100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocuy_7gebh5lk', '安素雙卡', 'E0100004', '250100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocv1_3t1o9j3r', '葡勝納SR菁選200ml', 'E0100005', '250100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocv3_oz4jlphi', '安素力沛力香草減甜RPB237ML', 'E0100006', '250100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocv6_atmiwnhz', '管灌安素', 'E0100007', '250100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocv9_ryl7lu96', '普寧勝8OZ', 'E0100008', '250100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvc_gfpd3z2a', '健力體', 'E0100009', '250100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvf_xx42dymc', '均衡營養素1008g', 'E0200001', '250200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvi_pgifxhka', 'MCT配方-F 250g', 'E0200002', '250200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvl_rxw91qx5', '勝補康營養配方800g', 'E0200003', '250200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvp_o05bbh0a', '均衡營養素 56G 150入', 'E0200004', '250200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvt_z4uzllmj', '奶蛋白500g (2罐禮盒組)', 'E0200005', '250200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocvw_domgbkbi', '啤酒酵母粉400G 24入', 'E0200006', '250200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocw1_uxkhl6dj', '粉貽 (1公斤12入)', 'E0200007', '250200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocw4_ntr57vpq', 'MCT配方-F 1000g 12入', 'E0200008', '250200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocw6_aq3y8ird', '膳食纖維350g', 'E0200009', '250200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocw8_cklkvkp6', '大豆卵磷脂顆粒300G/24入', 'E0200010', '250200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwb_9f6quwpi', 'LPF-N勝補康營養配方 825克/罐', 'E0200011', '250200011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwd_al2z3ou1', '立攝適均康1.5熱量濃縮完整均衡營養配方-香草口味', 'E0300001', '250300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwf_2bsvprpb', '立攝適盛健腎臟病透析適用配方香草口味237ml', 'E0300002', '250300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwi_088viw7b', '倍速益沛纖管灌專用配方', 'E0300003', '250300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwk_nbpikfi9', '補體素80  500g', 'E0400001', '250400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwn_ki71olyu', '補體素-低渣HN237/cc', 'E0400002', '250400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwq_rb6tjqmq', '益力壯優纖16(原味)', 'E0500001', '250500001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocws_9a4pf7d6', '益力壯20營養均衡完整配方-原味', 'E0500002', '250500002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocww_6o81h7sy', '舒肥雞胸肉便當', 'P0100001', '360100001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocwy_f75nlgmg', '舒肥鴨胸肉便當', 'P0100002', '360100002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocx0_eq5c60il', '雞腿便當', 'P0100003', '360100003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocx3_df3vue45', '排骨便當', 'P0100004', '360100004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocx7_2kthpeoz', '素食便當', 'P0100005', '360100005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxa_r85ofmtu', '舒肥豬肉便當', 'P0100006', '360100006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxc_0r7qqyee', '鯖魚便當', 'P0100007', '360100007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxf_pjq4vm1d', 'XO干貝醬炒飯', 'P0100008', '360100008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxi_vpqfd9r6', '紐澳良雞腿排便當', 'P0100009', '360100009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxl_md62p2xt', '阿根廷鮮魷魚', 'P0100010', '360100010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxo_s69dbddt', '五香里肌肉排', 'P0100011', '360100011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxr_nepmlr5k', '白醬義大利麵', 'P0100012', '360100012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxt_x6kgn0ag', '紅醬義大利麵', 'P0100013', '360100013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxw_5c9kx7kg', '青醬義大利麵', 'P0100014', '360100014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocxz_zranwy2r', '龍港滷味(鴨舌)', 'P0200001', '360200001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocy2_jp4rml91', '龍港滷味(鴨翅)', 'P0200002', '360200002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocy5_jqb6a23o', '龍港滷味(雞腳)', 'P0200003', '360200003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocy7_wh14sbm7', '龍港滷味(百頁豆腐)', 'P0200004', '360200004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocya_nwghiaws', '龍港滷味(豆干)', 'P0200005', '360200005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyd_qhyptrst', '龍港滷味(香魚)', 'P0200006', '360200006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyf_sq4fdkr3', '富貴香蹄膀', 'P0200007', '360200007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyh_fc2meipl', '黃金人蔘雞湯', 'P0200008', '360200008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyj_y53pohjw', '福氣豬腳', 'P0200009', '360200009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocym_0gf2isrb', '米糕', 'P0200010', '360200010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyo_2qfigf9n', '蔬菜包', 'P0300001', '360300001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyr_z3jlxwo4', '食物包', 'P0300002', '360300002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyt_662udbof', '肉品', 'P0300003', '360300003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyv_g5d1ioxr', '烤肉組A', 'P0300004', '360300004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocyx_64fxbdz5', '愛妃蘋果(粒)', 'P0400001', '360400001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocz0_hr1pced0', '粉紅佳人蘋果(粒)', NULL, '360400002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocz2_kyvqkytu', '啤梨(粒)', NULL, '360400003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocz5_uvaiufth', '粉紅佳人蘋果(組)', NULL, '360400004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocz7_bz7dixrq', '啤梨(組)', NULL, '360400005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocz9_v7cgw4ht', '蜜李(組)', 'P0400006', '360400006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczb_huc443ip', '砂糖橘(組)', 'P0400007', '360400007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ocze_vdjks71z', '情人李', 'P0400008', '360400008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczg_rdrkll14', '甘露梨', 'P0400009', '360400009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczk_jrsccpqp', 'Pione紫葡萄禮盒', 'P0400010', '360400010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczn_rqq4rwau', '紐西蘭炫光蘋果', 'P0400011', '360400011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczp_vu6aj3ea', '烏龜蛋李', 'P0400012', '360400012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczr_ovjwknid', '椰子', 'P0400013', '360400013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczt_bvepylo4', '韓國梨+蘋果禮盒', 'P0400014', '360400014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczv_6c05myo5', '青森蘋果禮盒', NULL, '360400015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oczy_u4o6mrk9', '青森蘋果', 'P0400016', '360400016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od01_p54ki9ah', '黃金奇異果(包)', 'P0400017', '360400017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od04_0ot1qi7r', '黃金奇異果(箱)', 'P0400018', '360400018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od07_7u6kz4s3', '酪梨(3入)', 'P0400019', '360400019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0a_ovagrvwg', '南非蜜蘋果', 'P0400020', '360400020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0d_2uzu2e0a', '美人李', 'P0400021', '360400021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0h_skx3vzcw', '紅心奇異果(袋)', 'P0400022', '360400022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0k_2j7xas6l', '水蜜桃蘋果(袋)', 'P0400023', '360400023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0n_x69848yv', '三陽開泰禮盒', 'P0500001', '360500001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0p_9fzo4brh', '三代福氣禮盒', 'P0500002', '360500002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0t_xv0jjcvl', '四季如意禮盒', 'P0500003', '360500003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0w_zuecvf48', '雙星報喜禮盒', 'P0500004', '360500004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od0z_slbeajqt', '四季發財禮盒', 'P0500005', '360500005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od12_qr3v0qmb', '誠意滿滿禮盒', 'P0500006', '360500006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od15_1xf0ka4b', '一馬當先禮盒', 'P0500007', '360500007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od18_w56accnd', '永保安康禮盒', 'P0500008', '360500008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1a_5hwm8usw', '一路發財禮盒', 'P0500009', '360500009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1d_yud76mpb', '好事多多禮盒', 'P0500010', '360500010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1g_t1nuhxmw', '五福臨門禮盒', 'P0500011', '360500011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1i_soqydyl4', '招財進寶禮盒', 'P0500012', '360500012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1l_cv0tvy2y', '萬事如意禮盒', 'P0500013', '360500013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1n_plmlll2b', '十全十美禮盒', 'P0500014', '360500014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1q_7r2eov1l', '四方禮盒', 'P0500015', '360500015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1s_yxxk1srr', '大香菇銀耳禮盒', 'P0500016', '360500016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1v_3z61u5sn', '香菇燕窩禮盒', 'P0500017', '360500017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od1x_sfyx7acc', '魷魚串', 'P0600001', '360600001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od20_xv5maztj', '檸檬翅小腿-小包裝', 'P0600002', '360600002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od22_5n9oc6i0', '檸檬翅小腿-大包裝', 'P0600003', '360600003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od25_5du9qp8h', 'XO干貝醬(微辣)', 'P0900001', '360900001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od28_6ocw5ws7', 'XO干貝醬(大辣)', 'P0900002', '360900002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2b_6flnrmfd', '迷你冬瓜磚', 'P0900003', '360900003', '塊', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2e_rj5xrj4n', '濾掛式肯亞AA(淺焙)', 'P0900004', '360900004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2g_9y5r9int', '濾掛式巴西(中淺焙)', 'P0900005', '360900005', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2j_fvfovj5h', '濾掛式曼特寧(中深焙)', 'P0900006', '360900006', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2l_6gzeksjk', '濾掛式巴拿馬(中焙)', 'P0900007', '360900007', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2o_jmn9owl2', '濾掛式耶加雪菲(中淺焙)', 'P0900008', '360900008', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2r_mvizs20y', '濾掛式哥斯大黎加', 'P0900009', '360900009', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2u_ipjshbsx', '中卷', 'P0900010', '360900010', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2w_k5j0ggda', '大肉魚', 'P0900011', '360900011', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od2z_bd0ncdti', '石鱸魚', 'P0900012', '360900012', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od32_n70vh3rk', '小白鯧', 'P0900013', '360900013', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od35_9x4253ca', '黑鯧', 'P0900014', '360900014', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od38_p84w40cb', '午仔魚', 'P0900015', '360900015', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3a_fh96oe3d', '黑口魚', 'P0900016', '360900016', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3c_3qjfm7fm', '吻仔魚(盒)', 'P0900017', '360900017', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3f_t4xbe2f8', '白刺蝦', 'P0900018', '360900018', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3h_c0gy9790', '開味橄欖', 'P0900019', '360900019', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3k_lh53iwsk', '洛神花', 'P0900020', '360900020', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3m_h30oj56f', '蜜棗', 'P0900021', '360900021', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3p_pin72osy', '乾甜梅', 'P0900022', '360900022', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3r_eojlx0qx', '仙李', 'P0900023', '360900023', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3u_nelfcati', '芒果乾', 'P0900024', '360900024', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3w_uj91fadq', '土鳳梨乾', 'P0900025', '360900025', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od3z_kofpcjb3', '聖女小蕃茄乾', 'P0900026', '360900026', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od41_nj40tzcr', '紅心芭樂乾', 'P0900027', '360900027', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od43_lwmfhmy4', '化核應子', 'P0900028', '360900028', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od45_0img2l7s', '小紅莓', 'P0900029', '360900029', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od48_fhnwjn9j', '紫蘇梅', 'P0900030', '360900030', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4a_6pwrgic5', '檸檬塔', 'P0900031', '360900031', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4d_pbguidx2', '一口烏魚子', 'P0900032', '360900032', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4g_8hm8gld9', '麻辣老油條', 'P0900033', '360900033', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4i_862t01q9', '咖哩老油條', 'P0900034', '360900034', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4m_upuff0z6', '芭樂乾HY', 'P0900035', '360900035', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4p_cktvuxlv', '哈密瓜乾HY', 'P0900036', '360900036', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4s_q4ti2gtr', '鳳梨乾HY', 'P0900037', '360900037', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4v_8izkaz15', '芒果乾HY', 'P0900038', '360900038', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od4y_fd57btqs', '香橙片HY', 'P0900039', '360900039', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od52_y385765v', '黑金一口烏魚子', 'P0900040', '360900040', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od56_anzl1wy9', '茂谷(大)', 'P0900041', '360900041', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od59_flbyvtg3', '茂谷禮盒(8入)', 'P0900042', '360900042', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5c_k1987q76', '日本蜜蘋果(8入)', 'P0900043', '360900043', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5i_taqls314', '香蕉酥', 'P0900044', '360900044', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5l_cfm33e5s', '韓國梨(6入)', 'P0900045', '360900045', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5o_h3r923h1', '韓國梨(粒)', 'P0900046', '360900046', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5r_gn3ml9zs', '日本蜜蘋果(粒)', 'P0900047', '360900047', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5t_bcli4s0w', '綠葡萄', 'P0900048', '360900048', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5x_5p5l6zog', '金紙組', 'P0900049', '360900049', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od5z_wmck99fo', '水果組', 'P0900050', '360900050', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od62_ocb67d5b', '三牲組', 'P0900051', '360900051', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od65_73cky1ra', '三牲四果組', 'P0900052', '360900052', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od68_oqq8fw4q', '拜拜超值組合', 'P0900053', '360900053', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6c_dc9f5xkz', '冷凍榴槤肉', NULL, '360900054', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6f_jk3vichd', '海鮮餅', 'P0900055', '360900055', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6j_dbyb9plc', '鮮肉芋頭貢丸', 'P0900056', '360900056', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6m_dgqh9cfu', '無籽綠葡萄', 'P0900057', '360900057', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6p_pchcxxr0', '原味生吐司', 'P0900058', '360900058', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6s_q2nxc51x', '巧克力生吐司', 'P0900059', '360900059', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6v_gxicfg0y', '外交官生吐司', 'P0900060', '360900060', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od6y_r838fbkt', '煙燻乾酪生吐司', 'P0900061', '360900061', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od71_ufevo88k', '焦糖葵瓜子', 'P0900062', '360900062', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od74_306nqw21', '智利紅葡萄', 'P0900063', '360900063', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od77_kjo7h2zu', '雨沐小米酒', 'P0900064', '360900064', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7a_oiztbwqw', '黑芝麻夾心絲', 'P0900065', '360900065', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7d_cm7t7yx9', '洛神香草茶', 'P0900066', '360900066', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7g_wlmyco4s', '洛神乾花', 'P0900067', '360900067', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7k_7ht4hv3y', '頂級龍眼蜜750g', 'P0900068', '360900068', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7n_hfk7986k', '頂級龍眼蜜420g', 'P0900069', '360900069', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7r_i2e524nr', '貴妃龍眼蜜750g', 'P0900070', '360900070', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7v_azq2kzv4', '貴妃龍眼蜜420g', 'P0900071', '360900071', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od7y_uzp4ntl6', '蜂蜜伴手禮盒', 'P0900072', '360900072', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od81_szmskw93', '原味南瓜子', 'P0900073', '360900073', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od84_kkw02tqs', '古早味糖霜腰果', 'P0900074', '360900074', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od88_ya8pnwdt', '海鹽葵瓜子', 'P0900075', '360900075', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8b_awt87vf7', '開心果', 'P0900076', '360900076', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8e_b136f82c', '蕃茄紅醬義大利麵', 'P0900077', '360900077', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8h_z0hnhnv9', '羅勒青醬義大利麵', 'P0900078', '360900078', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8k_kbciv1mb', '奶油白醬義大利麵', 'P0900079', '360900079', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8n_6xho5oru', '鹹湯圓', 'P0900080', '360900080', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8q_our1p3eu', '海鮮魚子醬', 'P0900081', '360900081', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8t_up3t1asw', '花枝貢丸', 'P0900082', '360900082', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8w_z466zonf', '蝦丸', 'P0900083', '360900083', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od8y_ald8xrx5', '烏金墨魚貢丸', 'P0900084', '360900084', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od92_wqs3bs1h', '麻辣花枝貢丸', 'P0900085', '360900085', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od94_8ewia436', '明太子秋刀魚', 'P0900086', '360900086', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od97_pucbdwjv', '明太子手羽', 'P0900087', '360900087', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9a_vxyb7ext', '蒲燒鰻魚', 'P0900088', '360900088', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9d_6fts5vhh', '醬燒鮑魚', 'P0900089', '360900089', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9f_shlk5f26', '白蝦(盒)', 'P0900090', '360900090', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9i_dea8pnr8', '紫米紅豆粥', NULL, '360900091', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9k_wmaa6bvj', '金虎爺沖浪浪杯', 'P1000001', '361000001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9n_tc72r4y3', '浪浪杯墊', 'P1000002', '361000002', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9p_sw7n3pty', '金虎爺飛高高杯', 'P1000003', '361000003', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9s_nscnht2g', '高高杯墊', 'P1000004', '361000004', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9u_1wmjzuut', '香蕉', 'A1', '610000001', '條', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9x_amtbcv95', '鳳梨', 'B2', '620000002', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61od9z_azwkb7g0', '茂谷', 'C2', '630000002', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oda1_k4xjymu8', '橘子', 'D1', '640000001', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oda3_3rh5017a', '柳丁', 'E1', '650000001', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oda6_xexjuqoo', '檸檬', 'F1', '660000001', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oda8_dgroj5sc', '秋葵', 'FA1', '666100001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odaa_ltusc7m1', '大黃瓜', 'FC1', '666300001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odad_0hiq5yp8', '小黃瓜', 'FD1', '666400001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odag_h3votqpp', '冬瓜', 'FE1', '666500001', '條', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odai_pw5mif04', '絲瓜', 'FF1', '666600001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odal_93joa9cg', '苦瓜', 'FG1', '666700001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odao_pw9c5s37', '扁蒲', 'FH4', '666800004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odaq_ffir4xwx', '茄子', 'FI2', '666900002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odas_idimmkkq', '蕃茄', 'FJ3', '667000003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odav_5u93or9n', '四季豆', 'FN1', '667100001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odax_fg81lplg', '紅椒', 'FK4', '667100004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odb0_f267jir7', '青椒', 'FK5', '667100005', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odb3_m33fl13f', '黃椒', 'FK4-1', '667100006', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odb6_fpc93e0d', '長豆', 'FM2', '667300002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odb8_oszkyifa', '南瓜', 'FT1', '668000001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbb_mmfmdp72', '辣椒', 'FV1', '668200001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbf_n6rxk1a5', '朝天椒', 'FV4', '668200004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbj_akjib6ri', '辣椒(加工)', 'FV1+10元', '668201101', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbm_z4m7xzl3', '朝天椒(加工)', 'FV4+10元', '668201104', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbp_jj2gje59', '玉米(帶殼)', 'FY6', '668500006', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbr_daah60fa', '玉米(去殼)', 'FY6+10', '668501106', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbu_8vjvvs3c', '青木瓜', 'I4', '690000004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odbx_klhp1rpc', '聖女小番茄', '72', '720000000', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odc0_rjss0zvo', '高麗菜', 'LA1', '726100001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odc4_3wkjqfrw', '小白菜', 'LB1', '726200001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odc7_p7vkjxcg', '鵝白菜', 'LB2', '726200002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odc9_hljlfpxk', '大白菜', 'LC3', '726300001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odcc_4tclkpgm', '大白菜進口', 'LC9', '726300009', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odce_d2fwglla', '青江菜', 'LD1', '726400001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odch_35hlyzxk', '空心菜', 'LF2', '726600002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odck_u9q8lzpo', '芹菜', 'LG2', '726700002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odcn_ii8t4co5', '芹菜去葉', 'LG2*1.5', '726711152', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odcp_wvjwzbgs', '菠菜', 'LH1', '726800001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odcs_yvxcc52m', 'A菜', 'LI3', '726900003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odcv_yh80ibxh', '大陸A', 'LI5', '726900005', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odcy_jqiphk9d', '大芥菜', 'LJ3', '727000003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odd0_yltp640b', '小芥菜', 'LJ4', '727000004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odd3_4qwuhysd', '芥藍菜', 'LK2', '727100002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odd6_2jdoxeg3', '茼萵', 'LL1', '727200001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odd9_416hnfww', '莧菜', 'LM2', '727300002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddc_uige0dvc', '油菜', 'LN1', '727400001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddf_6m5spkzd', '地瓜葉', 'LO1', '727500001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddi_9wk4bx0p', '香菜', 'LP1', '727600001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddl_6nbhoa31', '九層塔', 'LP2', '727600002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddo_69tsjwqn', '芭樂', 'P1', '760000001', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddq_6ed662gh', '白蘿蔔', 'SA3', '796100003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddt_tneo0wmu', '進口白蘿蔔', 'SA9', '796100009', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddv_de4fuwuv', '胡蘿蔔', 'SB2', '796200002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oddy_oz7k8xld', '馬鈴薯', 'SC1', '796300001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ode0_0yo1gfnq', '洋蔥', 'SD9', '796400009', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ode3_5mmr4865', '青蔥', 'SE6', '796500006', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ode5_3zt5g7rf', '韭菜', 'SF1', '796600001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ode7_47aw71r7', '韭菜花', 'SF3', '796600003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odea_edg28vvh', '蒜頭', 'SG5', '796700005', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61oded_1urup4gd', '蒜仁(台灣)', 'SG6', '796700006', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odeg_mhd022hc', '蒜末', 'SG6+10元', '796701106', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odej_rqur4e8q', '竹筍', 'SH5', '796800005', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odem_n8ah8a8n', '芋頭', 'SJ2', '797000002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odep_0h8t31es', '芋頭去皮', 'SJ2*1.5', '797011152', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odes_9n85bst8', '黃地瓜', 'SO1', '797500001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odev_qoi3l88p', '紅地瓜', 'SO3', '797500003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odey_fqfqam2e', '老薑', 'SP1', '797600001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odf0_rgsokcz3', '花椰菜', 'FB1', '797600002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odf3_wspoc3xi', '薑絲', 'SP1-10', '797600011', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odf8_8j40qc7b', '薑片', 'SP1+10元', '797601101', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfb_84ifrabe', '帶殼茭白筍', 'SQ1', '797700001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfd_nqk52i28', '茭白筍去殼', 'SQ3', '797700003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfg_pkd1jqsc', '大頭菜', 'SW1', '798300001', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfi_os864my7', '綠豆芽', 'SX1', '798400001', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfq_r3egxdah', '黃豆芽', 'SX2', '798400002', '包', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odft_7m7g9rqr', '苜蓿芽', 'SX4', '798400004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfw_vlk80una', '西瓜', 'T1', '800000001', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odfy_4cwpbazv', '小玉西瓜', 'T5', '800000005', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odg1_2vv5t1io', '火龍果', '812', '812000000', '粒', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odg3_o9q72zjg', '烏魚片', '40100056', '812000001', '個', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odg5_ul2d1qat', '香Q地瓜椪', '50300075', '812000002', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odg8_pcbydtvu', '乳酪絲', '50300065', '812000003', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odga_68n0t9ek', '蒜片', '10300038', '812000004', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odgc_4y1xeu9h', '奶油白菜', '10200071', '812000005', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odge_95do4hxa', '大豆苗', '10200069', '812000006', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61odgg_sy3p0awo', '乾蘿蔔絲', '210200030', '812000007', '公斤', 1, NULL);
INSERT INTO public.products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES ('prod_mm61ochq_ut1d802h', '10元prntel標準型橡皮擦', 'C0700005', '230700005', '個', 0, '2026-02-28 08:49:38.782264+00');


--
-- Data for Name: customer_product_aliases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customer_product_aliases (id, customer_id, product_id, alias) VALUES ('cpa_mmuml31l_c0wm2u7z', 'cust_mm8pfq2r_mhhkq99i', 'prod_mm61oddq_6ed662gh', '白蘿蔔(白K)');
INSERT INTO public.customer_product_aliases (id, customer_id, product_id, alias) VALUES ('cpa_mmwpgmwb_9a1aiqw3', 'cust_mm8pfq2r_mhhkq99i', 'prod_mm61oavj_ro3hoer7', '豆乾(豆干)');


--
-- Data for Name: inventory_warehouses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: daily_inventory; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: erp_sales; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: freezer_fridge_daily; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: freezer_fridge_warehouses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inventory_warehouse_products; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: line_bot_state_log; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: logistics_orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: logistics_order_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.orders (id, customer_id, order_date, line_group_id, raw_message, status, updated_at, order_no) VALUES ('ord_mmblai56_jirf2po4', 'cust_mm8pfq2r_mhhkq99i', '2026-03-04', 'C48764d2a8908f997740d3d1408588d4a', '[圖片]
[圖片]
清江菜4公斤，大陸妹2公斤，秀珍菇2公斤，白靈菇2公斤，杏鮑菇1公斤，四季豆1公斤，黑木耳0.5公斤，蔥0.5公斤，茄子1公斤', 'pending', '2026-03-04 05:26:26.401979+00', '20260304001');
INSERT INTO public.orders (id, customer_id, order_date, line_group_id, raw_message, status, updated_at, order_no) VALUES ('ord_mm8zkofa_yyrscn38', 'cust_mm8pfq2r_mhhkq99i', '2026-03-02', 'C48764d2a8908f997740d3d1408588d4a', '大白菜1
高麗菜2
菠菜5
|青江菜6
油菜1
結束
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
鵝白菜 6k
薑絲1k
蒜碎1k攪2次
鵝白菜 6k
薑絲1k
蒜碎1k攪2次', 'pending', '2026-03-02 13:22:02.402379+00', NULL);
INSERT INTO public.orders (id, customer_id, order_date, line_group_id, raw_message, status, updated_at, order_no) VALUES ('ord_mmulqiod_xjvwy5bj', 'cust_mm8pfq2r_mhhkq99i', '2026-03-17', 'C48764d2a8908f997740d3d1408588d4a', '[圖片]
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
結束
結束
訂貨單
訂貨單號:115020611
客戶:健康廚房
訂貨日期:115/02/06
採買單位:
聯絡人:鳳蓮
聯絡電話:130
財團法人聖母健康農莊
製表日期:115/02/24
頁數:12
交貨日期:115/03/18
場別:聖母農莊
地址:
序號 品名
☑1
藥膳包-藥燉補排骨(燉補排骨)
單位
包
數量
單價
小計 備註
改2包子 65.00
195.00
2枸杞
3 白蘿蔔(白K)
1斤/包
公斤
1230.00
230.00
11 31.00
341.00
45
雞腿/小棒腿(5)(老人餐)
18公斤/箱
1 2,250.
2,250.00
雞腿/小棒腿(5)(老人餐)
6公斤/包
2 750.00
1,500.00
6 豆乾(豆干)
公斤
9 68.00
612.00
7 西洋芹(西芹)
公斤
3
90.00
270.00
8 黑木耳(去頭)(新鮮)
公斤
5 77.00
-385.00
9
乾香菇(中)
1斤/包
1 900.00
900.00
10
包心白菜
公斤
16 150.00
2,400.00
11
蔬菜(青菜)
公斤
19 0.00
0.00
12 冷凍三色豆
1公斤/包
8 65.00
520.00
13
洋蔥
袋
1 792.00
792.00
14
青椒
公斤
2 46.00
92.00
15
肉角(肉塊)(冷凍)
5 110.00
550.00
16
全瘦肉塊(冷凍)
斤
13 115.00
1,495.00
17 雞蛋
20斤/箱
1 800.00
800.00
-18 一生香菇(大)
公斤
1 145.00
145.00
19
絞肉/冷凍
斤
2 105.00
210.00
20 茼蒿
21 蔬菜(青菜)
公斤
10 0.00
0.00
公斤
11 0.00
0.00
合計金額:13,687.00
營業稅:11
其他款項: 0
總計金額:13,687
備註:
價格稅金:內含
經辦人:劉鳳蓮
製表人:劉鳳蓮', 'pending', '2026-03-17 13:02:41.83229+00', '20260317001');
INSERT INTO public.orders (id, customer_id, order_date, line_group_id, raw_message, status, updated_at, order_no) VALUES ('ord_mn2o6vw6_4r90mm63', 'cust_mm8pfq2r_mhhkq99i', '2026-03-23', 'C48764d2a8908f997740d3d1408588d4a', '哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k', 'pending', '2026-03-23 04:12:48.298615+00', '20260323001');
INSERT INTO public.orders (id, customer_id, order_date, line_group_id, raw_message, status, updated_at, order_no) VALUES ('ord_mmal9nm3_2k33a6lt', 'cust_mm8pfq2r_mhhkq99i', '2026-03-03', 'C48764d2a8908f997740d3d1408588d4a', '鵝白菜 6k
薑絲1k
蒜碎1k攪2次
白菜 6k
薑絲1k
蒜碎1k攪2次
白菜 6k
薑絲1k
蒜碎1k攪2次
[圖片]
結束
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k
哈嘍明天我要
大陸妹2k
A菜2k，
青蔥1k
芹菜2小把
洋蔥5k', 'pending', '2026-03-03 22:03:33.610208+00', '20260303001');


--
-- Data for Name: order_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmalrqyl_b5nmazu0', 'ord_mmal9nm3_2k33a6lt', '603494461053600025', '2026-03-03 12:47:29.929689+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmb701h9_6242fwk7', 'ord_mmal9nm3_2k33a6lt', '603554300903555109', '2026-03-03 22:41:48.669953+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmblaij6_ywxivxnq', 'ord_mmblai56_jirf2po4', '603594567094894763', '2026-03-04 05:21:52.149991+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmblaz8t_427zf7zw', 'ord_mmblai56_jirf2po4', '603594619858714835', '2026-03-04 05:22:13.614047+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmblel0e_vkdxizw1', 'ord_mmblai56_jirf2po4', '603594893176865466', '2026-03-04 05:25:01.790401+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmbletjo_hdb3ug6i', 'ord_mmblai56_jirf2po4', '603594915271934465', '2026-03-04 05:25:13.352201+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmulqira_4138tebs', 'ord_mmulqiod_xjvwy5bj', '605523282724913680', '2026-03-17 12:41:56.086242+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmulqofq_nli108jc', 'ord_mmulqiod_xjvwy5bj', '605523303259963616', '2026-03-17 12:42:03.544581+00');
INSERT INTO public.order_attachments (id, order_id, line_message_id, created_at) VALUES ('att_mmumgu3v_bw85l3ua', 'ord_mmulqiod_xjvwy5bj', '605525316089938384', '2026-03-17 13:02:23.942428+00');


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm8zwks5_zghhw9ae', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odc9_hljlfpxk', '大白菜', 1, '公斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm8zwksg_m1pubt8k', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odc0_rjss0zvo', '高麗菜', 2, '公斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm8zwksp_6cpbd237', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odcp_wvjwzbgs', '菠菜', 5, '公斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm8zwkt4_qjyl0auv', 'ord_mm8zkofa_yyrscn38', 'prod_mm61oddc_uige0dvc', '油菜', 1, '公斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm8zwksw_u0jjc6qa', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odce_d2fwglla', '|青江菜', 6, '公斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96b0oi_870lfu27', 'ord_mm8zkofa_yyrscn38', 'prod_mm61ode3_5mmr4865', '青蔥 k', 1, 'k', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96b0o9_q0ei86g4', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odcs_yvxcc52m', 'A菜 k，', 2, 'k，', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm975zxi_1c46fops', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odc7_p7vkjxcg', '鵝白菜', 6, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm975zxr_c85dhm0b', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odf3_wspoc3xi', '薑絲', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm975zy0_gi30tlrc', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odeg_mhd022hc', '蒜碎 k攪2次', 1, 'k攪2次', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm97kbgr_ezt75jek', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odc7_p7vkjxcg', '鵝白菜', 6, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm97kbh1_cgb2p3bq', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odf3_wspoc3xi', '薑絲', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm97kfem_4wj12605', 'ord_mm8zkofa_yyrscn38', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmal9nmu_lho8a0m6', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odc7_p7vkjxcg', '鵝白菜', 6, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmal9nn6_mu6dtxrv', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odf3_wspoc3xi', '薑絲', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalabrz_6btr8sfa', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odf3_wspoc3xi', '薑絲', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmaladkz_y5mu3asd', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmall270_pac6yjpq', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalotlj_9subpa7g', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odf3_wspoc3xi', '薑絲', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalyn9b_qhluygvh', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalyn9j_1gjnp547', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalyn9p_ofi5f1dy', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalyn9x_kq9ovtqa', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamaf26_tss2ei75', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamaf2f_m3ncnkpt', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamaf2m_pfe18vqf', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamaf2v_bytln4xd', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmambdnq_yh63d3so', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmambdny_nchj9ftj', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmambdo6_uya9hsat', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmambdod_4q9o5ozv', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamdyps_vc4v8n5x', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamdyq4_3ah0tlt8', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamdyqf_f9uwo82c', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamdyqr_utdhj2z0', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmame0bz_rxqhlmt0', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96bg68_57uqoifo', 'ord_mm8zkofa_yyrscn38', 'prod_mm61ode3_5mmr4865', '青蔥 k', 1, 'k', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96b0or_m5a4flp9', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odck_u9q8lzpo', '芹菜 小', 2, '把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96bg6h_f7j00q4r', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odck_u9q8lzpo', '芹菜 小', 2, '把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96b0oz_gqy6ie7m', 'ord_mm8zkofa_yyrscn38', 'prod_mm61ode0_0yo1gfnq', '洋蔥 k', 5, 'k', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96bg6o_9tbigu5x', 'ord_mm8zkofa_yyrscn38', 'prod_mm61ode0_0yo1gfnq', '洋蔥 k', 5, 'k', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96bg5t_gbxlq0jm', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odcv_yh80ibxh', '大陸妹 k', 2, 'k', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm96bg61_50o9bkpj', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odcs_yvxcc52m', 'A菜 k，', 2, 'k，', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mm97kbha_ek537w4n', 'ord_mm8zkofa_yyrscn38', 'prod_mm61odeg_mhd022hc', '蒜碎 k攪2次', 1, 'k攪2次', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmal9nnf_7fdcu281', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odeg_mhd022hc', '蒜碎 k攪2次', 1, 'k攪2次', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalabsa_dgc3x5k7', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odeg_mhd022hc', '蒜碎 k攪2次', 1, 'k攪2次', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalotlr_zni6pwpq', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odeg_mhd022hc', '蒜碎 k攪2次', 1, 'k攪2次', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalabro_ox0f265o', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odc9_hljlfpxk', '白菜', 6, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalotla_borpc5z6', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odc9_hljlfpxk', '白菜', 6, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmalyn92_rsm5irj0', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamaf1y_ehnmjp6j', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmambdnh_6kt9x26x', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmamdyph_yk9ug0h1', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kjr2_73n244za', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kjrb_vemxde1q', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kjrj_ehc4rfzl', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kjrq_b0h5xny9', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kjrw_mozj4cfz', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kn6u_huaus8ko', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kvku_nbqhymcc', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kvl0_kps7e0n5', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kvl7_xikuuzih', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kvle_czmtzaha', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kvll_vqm01w51', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5kyay_8vst5vnz', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5muks_2qonwtrn', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5mul0_0wqtjtf5', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5mul6_56tmq1tf', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5muld_squ2muvq', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5muli_6sm74rp7', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb5n0x0_kzaqitqo', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmb70d17_l2zfohv8', 'ord_mmal9nm3_2k33a6lt', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzf3_u30fj6y0', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61obh8_egvna85i', '枸杞', 2, '枸杞', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzg8_m3js9w39', 'ord_mmulqiod_xjvwy5bj', NULL, '雞腿/小棒腿( )(老人餐)', 5, ')(老人餐)', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzgi_3vo1zsho', 'ord_mmulqiod_xjvwy5bj', NULL, '公斤/', 18, '箱', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzgs_9zy4wbln', 'ord_mmulqiod_xjvwy5bj', NULL, '2,250', 1, '2,250.', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzh3_ljooso60', 'ord_mmulqiod_xjvwy5bj', NULL, ',250.00', 2, ',250.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzhe_zoykw3a6', 'ord_mmulqiod_xjvwy5bj', NULL, '雞腿/小棒腿( )(老人餐)', 5, ')(老人餐)', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzhp_trdzf71i', 'ord_mmulqiod_xjvwy5bj', NULL, '公斤/', 6, '包', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzhz_kharhb0k', 'ord_mmulqiod_xjvwy5bj', NULL, '750.00', 2, '750.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzia_3h7fhl94', 'ord_mmulqiod_xjvwy5bj', NULL, ',500.00', 1, ',500.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgziu_0uvvg8f1', 'ord_mmulqiod_xjvwy5bj', NULL, '68.00', 9, '68.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzj5_5duavz7b', 'ord_mmulqiod_xjvwy5bj', NULL, '西洋芹(西芹)', 7, '西洋芹(西芹)', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzjf_bht3yqe9', 'ord_mmulqiod_xjvwy5bj', NULL, '黑木耳(去頭)(新鮮)', 8, '黑木耳(去頭)(新鮮)', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmblb48p_scsuki3v', 'ord_mmblai56_jirf2po4', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, NULL, NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmbleyw2_ap92wi1b', 'ord_mmblai56_jirf2po4', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, NULL, NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzjo_ro0c19ip', 'ord_mmulqiod_xjvwy5bj', NULL, '77.00', 5, '77.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmblgeb1_z1gnvlbw', 'ord_mmblai56_jirf2po4', NULL, '清江菜 公斤，大陸妹2公斤，秀珍菇2公斤，白靈菇2公斤，杏鮑菇1公斤，四季豆1公斤，黑木耳0.5公斤，蔥0.5公斤，茄子1', 4, '公斤', NULL, 1, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmblggmk_oxdfpwdx', 'ord_mmblai56_jirf2po4', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, NULL, NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzjx_yebqrtlf', 'ord_mmulqiod_xjvwy5bj', NULL, '-', 385, '公斤', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmulqw0k_31yn2kqa', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmulsrbk_akn1zk05', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzk7_5mci71ff', 'ord_mmulqiod_xjvwy5bj', NULL, '斤/', 1, '包', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmulsrbv_f1g0aapl', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmulsrc4_dv24jho1', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzkh_9vhx5oo3', 'ord_mmulqiod_xjvwy5bj', NULL, '900.00', 1, '900.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmulsrcc_3f1oh1k7', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmulsrcm_s42gpt8f', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmult3cj_9k33a5qu', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgw3g_psajsqmu', 'ord_mmulqiod_xjvwy5bj', NULL, '訂貨單號:', 115020611, '公斤', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgx3k_xxwjpfj9', 'ord_mmulqiod_xjvwy5bj', NULL, '訂貨日期: /02/06', 115, '/02/06', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgy0z_lh0vxc5e', 'ord_mmulqiod_xjvwy5bj', NULL, '聯絡電話:', 130, '公斤', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgy9g_r6fsjk8b', 'ord_mmulqiod_xjvwy5bj', NULL, '製表日期: /02/24', 115, '/02/24', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgyy8_zd2b78lz', 'ord_mmulqiod_xjvwy5bj', NULL, '頁數:', 12, '公斤', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzc4_dpzyd37t', 'ord_mmulqiod_xjvwy5bj', NULL, '交貨日期: /03/18', 115, '/03/18', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzee_jo9wx3qx', 'ord_mmulqiod_xjvwy5bj', NULL, '☑', 1, '公斤', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzer_iyp67emv', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzet_0dheirlt', 'ord_mmulqiod_xjvwy5bj', NULL, '改 包子 65.00', 2, '包子 65.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzkq_mev4tdqr', 'ord_mmulqiod_xjvwy5bj', NULL, '150.00', 16, '150.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzn8_1lvys3rp', 'ord_mmulqiod_xjvwy5bj', NULL, ',400.00', 2, ',400.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzvr_i8ua51up', 'ord_mmulqiod_xjvwy5bj', NULL, '0.00', 19, '0.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh09f_i5jnikix', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oapp_hw32s3e6', '冷凍三色豆', 12, '冷凍三色豆', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh0kk_pgn50w1m', 'ord_mmulqiod_xjvwy5bj', NULL, '公斤/', 1, '包', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh11b_wqazj8wo', 'ord_mmulqiod_xjvwy5bj', NULL, '65.00', 8, '65.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh1q8_2x0pd889', 'ord_mmulqiod_xjvwy5bj', NULL, '792.00', 1, '792.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh249_iv354x9a', 'ord_mmulqiod_xjvwy5bj', NULL, '46.00', 2, '46.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh2cg_p2fa4i78', 'ord_mmulqiod_xjvwy5bj', NULL, '110.00', 5, '110.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzik_li1nuxpn', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oavj_ro3hoer7', '豆乾(豆干)', 6, '豆乾(豆干)', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh2fe_87yl8418', 'ord_mmulqiod_xjvwy5bj', NULL, '115.00', 13, '115.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh2qh_obbxq4m6', 'ord_mmulqiod_xjvwy5bj', NULL, ',495.00', 1, ',495.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh3kw_h6z2cum9', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oaub_bw0mvori', '雞蛋', 17, '雞蛋', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh3td_dgp87hl0', 'ord_mmulqiod_xjvwy5bj', NULL, '斤/', 20, '箱', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh4ic_cz6v78k5', 'ord_mmulqiod_xjvwy5bj', NULL, '800.00', 1, '800.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh4w4_ipvwjl2d', 'ord_mmulqiod_xjvwy5bj', NULL, '- 一生香菇(大)', 18, '一生香菇(大)', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh5a0_4fx0wspm', 'ord_mmulqiod_xjvwy5bj', NULL, '145.00', 1, '145.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh5nw_7udziduy', 'ord_mmulqiod_xjvwy5bj', NULL, '105.00', 2, '105.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh624_m8a3xoiy', 'ord_mmulqiod_xjvwy5bj', NULL, '茼蒿', 20, '茼蒿', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh6cz_0hac030u', 'ord_mmulqiod_xjvwy5bj', NULL, '蔬菜(青菜)', 21, '蔬菜(青菜)', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh6qs_pz12seyx', 'ord_mmulqiod_xjvwy5bj', NULL, '0.00', 10, '0.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh71w_yp8i3r42', 'ord_mmulqiod_xjvwy5bj', NULL, '0.00', 11, '0.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh7ab_gjap0c8a', 'ord_mmulqiod_xjvwy5bj', NULL, '合計金額: ,687.00', 13, ',687.00', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh7lf_c60smwqt', 'ord_mmulqiod_xjvwy5bj', NULL, '營業稅:', 11, '公斤', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumh7wl_3v1fa5nv', 'ord_mmulqiod_xjvwy5bj', NULL, '總計金額: ,687', 13, ',687', NULL, 1, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mmumgzfe_ei14elm9', 'ord_mmulqiod_xjvwy5bj', 'prod_mm61oddq_6ed662gh', '白蘿蔔(白K)', 3, '白蘿蔔(白K)', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mn2o6vwm_33670nqz', 'ord_mn2o6vw6_4r90mm63', 'prod_mm61odcv_yh80ibxh', '大陸妹', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mn2o6vwu_zq2nncig', 'ord_mn2o6vw6_4r90mm63', 'prod_mm61odcs_yvxcc52m', 'A菜', 2, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mn2o6vx2_8gr3mu7n', 'ord_mn2o6vw6_4r90mm63', 'prod_mm61ode3_5mmr4865', '青蔥', 1, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mn2o6vxc_o8e5os0z', 'ord_mn2o6vw6_4r90mm63', 'prod_mm61odck_u9q8lzpo', '芹菜', 2, '小把', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mn2o6vxj_5oosjjtd', 'ord_mn2o6vw6_4r90mm63', 'prod_mm61ode0_0yo1gfnq', '洋蔥', 5, '斤', NULL, 0, NULL);
INSERT INTO public.order_items (id, order_id, product_id, raw_name, quantity, unit, remark, need_review, include_export) VALUES ('item_mn2obyx1_hhq7hgz3', 'ord_mn2o6vw6_4r90mm63', 'prod_mm61oc0c_e6lza89n', '四角方籃', 0, '個', NULL, 0, 1);


--
-- Data for Name: product_aliases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmames8x_4jms19ai', 'prod_mm61ode3_5mmr4865', '青蔥 k');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamewiu_i6seek8w', 'prod_mm61odck_u9q8lzpo', '芹菜 小');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamezku_oiz3a4lp', 'prod_mm61ode0_0yo1gfnq', '洋蔥 k');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamf2z2_hngj4svm', 'prod_mm61odcv_yh80ibxh', '大陸妹 k');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamf6ye_kvmlqccb', 'prod_mm61odcs_yvxcc52m', 'A菜 k，');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamfa8r_9zbydrx2', 'prod_mm61odeg_mhd022hc', '蒜碎 k攪2次');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamfgqt_4um2mic2', 'prod_mm61odc9_hljlfpxk', '白菜');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmamfjen_zrkfe7pf', 'prod_mm61odcv_yh80ibxh', '大陸妹');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmuml31g_8rjzy32g', 'prod_mm61oddq_6ed662gh', '白蘿蔔(白K)');
INSERT INTO public.product_aliases (id, product_id, alias) VALUES ('pa_mmwpgmw8_5flv6exl', 'prod_mm61oavj_ro3hoer7', '豆乾(豆干)');


--
-- Data for Name: product_unit_specs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict JLpviSP7EIdLDjLFxPSu007TdNnbWdQPymLhzene3tWWP7TnisjWPnQwpZIXJOJ

