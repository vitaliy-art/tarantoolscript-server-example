import * as luatest from 'luatest';
import { serve } from '../server';
import { Box, UuidObject } from 'tarantoolscript';
import * as httpClient from 'http.client';
import { createUser, migrationsUp } from '../schema';
import * as uuid from 'uuid';
import * as json from 'json';

declare const box: Box;

const tmpDir = uuid.new_().str();
const userName = 'user';
const userPass = 'pass';
const host = 'localhost';
const port = 8888;
const httpHost = `${host}:${port}`;

luatest.before_suite(() => {
    os.execute(`mkdir -p ./test/tmp/${tmpDir}`);

    box.cfg({
        work_dir: `./test/tmp/${tmpDir}`,
        log_level: 'debug',
    });

    serve(host, port, true);
});

luatest.after_suite(() => {
    os.execute(`rm -rf ./test/tmp/${tmpDir}`);
});

const g = luatest.group('app');

g.set('test_create_user', () => {
    createUser(userName, userPass);
    luatest.assert_equals(box.schema.user.exists(userName), true);
});

g.set('test_migrations_up', () => {
    migrationsUp(userName);
    luatest.assert_is_not(box.space.get('partners'), undefined);
    luatest.assert_is_not(box.space.get('matches'), undefined);
});

g.set('test_partners_format', () => {
    const id = uuid.new_();
    const name = 'name';
    const tuple = box.space.get('partners').frommap({ id, name });
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_is(tuple.id, id);
    luatest.assert_is(tuple.name, name);
});

g.set('test_matches_format', () => {
    const user_id = uuid.new_();
    const partner1_id = uuid.new_();
    const partner1_user_id = uuid.new_();
    const partner1_ts = os.time(os.date('*t'));
    const partner2_id = uuid.new_();
    const partner2_user_id = uuid.new_();
    const partner2_ts = os.time(os.date('*t'));
    const partner_ids = {
        [partner1_id.str()]: { id: partner1_user_id, timestamp: partner1_ts },
        [partner2_id.str()]: { id: partner2_user_id, timestamp: partner2_ts },
    };

    const tuple = box.space.get('matches').frommap({ id: user_id, partner_ids });
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_is(tuple.id, user_id);
    luatest.assert_type(tuple.partner_ids, 'table');

    const partner1_map = tuple.partner_ids[partner1_id.str()];
    luatest.assert_type(partner1_map, 'table');
    luatest.assert_is(partner1_map.id, partner1_user_id);
    luatest.assert_is(partner1_map.timestamp, partner1_ts);

    const partner2_map = tuple.partner_ids[partner2_id.str()];
    luatest.assert_type(partner2_map, 'table');
    luatest.assert_is(partner2_map.id, partner2_user_id);
    luatest.assert_is(partner2_map.timestamp, partner2_ts);
});

g.after_test('test_matches_format', () => {
    box.space.get('matches').truncate();
    box.space.get('partners').truncate();
});

let user1_id: UuidObject;
const user2_id = uuid.new_();
const partner1_id = uuid.new_();
const partner1_name = 'partner1';
const partner1_user1_id = uuid.new_();
const partner1_user2_id = uuid.new_();
const partner2_id = uuid.new_();
const partner2_name = 'partner2';
const partner2_user1_id = uuid.new_();
const partner2_user2_id = uuid.new_();

g.set('test_server_partners_empty', () => {
    const resp = httpClient.get(`${httpHost}/partners`);
    luatest.assert_equals(resp.status, 200);
    const body = json.decode(resp.body || '');
    luatest.assert_type(body, 'table');
    luatest.assert_equals((body as Array<unknown>).length, 0);
});

g.set('test_server_partners_by_id_not_found', () => {
    const resp = httpClient.get(`${httpHost}/partners/${uuid.new_()}`);
    luatest.assert_equals(resp.status, 404);
});

g.set('test_server_partners_by_id_bad_request', () => {
    const resp = httpClient.get(`${httpHost}/partners/some_id`);
    luatest.assert_equals(resp.status, 400);
});

g.set('test_server_partners_post_empty_body', () => {
    const resp = httpClient.post(`${httpHost}/partners`);
    luatest.assert_equals(resp.status, 400);
});

g.set('test_server_partners_post_miss_fields', () => {
    const addr = `${httpHost}/partners`;
    let resp = httpClient.post(addr, {});
    luatest.assert_equals(resp.status, 400);
    resp = httpClient.post(addr, { id: partner1_id });
    luatest.assert_equals(resp.status, 400);
    resp = httpClient.post(addr, { name: partner1_name });
    luatest.assert_equals(resp.status, 400);
});

g.set('test_server_partners_post_success', () => {
    const addr = `${httpHost}/partners`;
    const space = box.space.get('partners');

    let resp = httpClient.post(addr, { id: partner1_id, name: partner1_name });
    luatest.assert_equals(resp.status, 200);
    luatest.assert_equals(space.count(), 1);
    let tuple = space.get(partner1_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, partner1_id);
    luatest.assert_equals(tuple?.name, partner1_name);

    resp = httpClient.post(addr, { id: partner2_id, name: partner2_name });
    luatest.assert_equals(resp.status, 200);
    luatest.assert_equals(space.count(), 2);
    tuple = space.get(partner2_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, partner2_id);
    luatest.assert_equals(tuple?.name, partner2_name);
});

g.set('test_server_partners_get_all', () => {
    const resp = httpClient.get(`${httpHost}/partners`);
    luatest.assert_equals(resp.status, 200);
    const body = json.decode(resp.body ?? '');
    luatest.assert_type(body, 'table');
    luatest.assert_equals((body as Array<unknown>).length, 2);

    const partner1 = (body as Array<{ id: string, name: string }>).find(p => p.id === partner1_id.str());
    luatest.assert_type(partner1, 'table');
    luatest.assert_equals(partner1?.name, partner1_name);

    const partner2 = (body as Array<{ id: string, name: string }>).find(p => p.id === partner2_id.str());
    luatest.assert_type(partner2, 'table');
    luatest.assert_equals(partner2?.name, partner2_name);
});

g.set('test_server_partners_get_by_id', () => {
    const addr = `${httpHost}/partners`;

    let resp = httpClient.get(`${addr}/${partner1_id}`);
    luatest.assert_equals(resp.status, 200);
    let body = json.decode(resp.body ?? '') as { id: string, name: string } | undefined;
    luatest.assert_type(body, 'table');
    luatest.assert_equals(body?.id, partner1_id.str());
    luatest.assert_equals(body?.name, partner1_name);

    resp = httpClient.get(`${addr}/${partner2_id}`);
    luatest.assert_equals(resp.status, 200);
    body = json.decode(resp.body ?? '') as { id: string, name: string } | undefined;
    luatest.assert_type(body, 'table');
    luatest.assert_equals(body?.id, partner2_id.str());
    luatest.assert_equals(body?.name, partner2_name);
});

g.set('test_server_sync_request_headers_unknown_partner', () => {
    const resp = httpClient.get(`${httpHost}/sync/${uuid.new_()}/${uuid.new_()}`, { headers: { origin: 'some_origin' } });
    luatest.assert_equals(resp.status, 200);
    const headers = resp.headers;
    luatest.assert_type(headers, 'table');
    luatest.assert_equals(headers!['access-control-allow-credentials'], 'true');
    luatest.assert_equals(headers!['access-control-allow-origin'], 'some_origin');
    const cookie = resp.cookies;
    luatest.assert_type(cookie, 'table');
    const userIdStr = cookie?.user_id;
    luatest.assert_type(userIdStr, 'table');
    luatest.assert_type(userIdStr![0], 'string');
    user1_id = uuid.fromstr(userIdStr![0]);
    luatest.assert_type(user1_id, 'cdata');
    luatest.assert_equals(box.space.get('matches').count(), 0);
});

g.set('test_server_sync_users_with_no_matches', () => {
    const space = box.space.get('matches');

    let resp = httpClient.get(`${httpHost}/sync/${partner1_id}/${partner1_user1_id}`, { headers: { cookie: `user_id=${user1_id}` } });
    luatest.assert_equals(resp.status, 200);
    luatest.assert_equals(space.count(), 1);
    let tuple = space.get(user1_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, user1_id);
    let match = tuple?.partner_ids;
    luatest.assert_type(match, 'table');
    let pMatch = match[partner1_id.str()];
    luatest.assert_type(pMatch, 'table');
    luatest.assert_equals(pMatch.id, partner1_user1_id.str());
    luatest.assert_type(pMatch.timestamp, 'number');

    resp = httpClient.get(`${httpHost}/sync/${partner1_id}/${partner1_user2_id}`, { headers: { cookie: `user_id=${user2_id}` } });
    luatest.assert_equals(resp.status, 200);
    luatest.assert_equals(space.count(), 2);
    tuple = space.get(user2_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, user2_id);
    match = tuple?.partner_ids;
    luatest.assert_type(match, 'table');
    pMatch = match[partner1_id.str()];
    luatest.assert_type(pMatch, 'table');
    luatest.assert_equals(pMatch.id, partner1_user2_id.str());
    luatest.assert_type(pMatch.timestamp, 'number');
});

g.set('test_server_sync_users_with_not_empty_matches', () => {
    const space = box.space.get('matches');

    let resp = httpClient.get(`${httpHost}/sync/${partner2_id}/${partner2_user1_id}`, { headers: { cookie: `user_id=${user1_id}` } });
    luatest.assert_equals(resp.status, 200);
    luatest.assert_equals(space.count(), 2);
    let tuple = space.get(user1_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, user1_id);
    let match = tuple?.partner_ids;
    luatest.assert_type(match, 'table');
    luatest.assert_type(match[partner1_id.str()], 'table');
    let pMatch = match[partner2_id.str()];
    luatest.assert_type(pMatch, 'table');
    luatest.assert_equals(pMatch.id, partner2_user1_id.str());
    luatest.assert_type(pMatch.timestamp, 'number');

    resp = httpClient.get(`${httpHost}/sync/${partner2_id}/${partner2_user2_id}`, { headers: { cookie: `user_id=${user2_id}` } });
    luatest.assert_equals(resp.status, 200);
    luatest.assert_equals(space.count(), 2);
    tuple = space.get(user2_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, user2_id);
    match = tuple?.partner_ids;
    luatest.assert_type(match, 'table');
    luatest.assert_type(match[partner1_id.str()], 'table');
    pMatch = match[partner2_id.str()];
    luatest.assert_type(pMatch, 'table');
    luatest.assert_equals(pMatch.id, partner2_user2_id.str());
    luatest.assert_type(pMatch.timestamp, 'number');
});

g.set('test_server_sync_update_partner_user_id', () => {
    const newId = uuid.new_();
    const resp = httpClient.get(`${httpHost}/sync/${partner1_id}/${newId}`, { headers: { cookie: `user_id=${user1_id}` } });
    luatest.assert_equals(resp.status, 200);
    const space = box.space.get('matches');
    luatest.assert_equals(space.count(), 2);
    const tuple = space.get(user1_id);
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_equals(tuple?.id, user1_id);
    const match = tuple?.partner_ids;
    luatest.assert_type(match, 'table');
    const pMatch = match[partner1_id.str()];
    luatest.assert_type(pMatch, 'table');
    luatest.assert_equals(pMatch.id, newId.str());
});

g.set('test_server_match_wrong_ids', () => {
    let resp = httpClient.get(`${httpHost}/match`);
    luatest.assert_equals(resp.status, 400);
    resp = httpClient.get(`${httpHost}/match?user_id=some_id`);
    luatest.assert_equals(resp.status, 400);
    resp = httpClient.get(`${httpHost}/match?partner_id=some_id`);
    luatest.assert_equals(resp.status, 400);
});

g.set('test_server_match_unknown_partner', () => {
    const resp = httpClient.get(`${httpHost}/match?partner_id=${uuid.new_()}&user_id=${user1_id}`);
    luatest.assert_equals(resp.status, 404);
});

g.set('test_server_match_unknown_user', () => {
    const resp = httpClient.get(`${httpHost}/match?partner_id=${partner1_id}&user_id=${uuid.new_()}`);
    luatest.assert_equals(resp.status, 404);
});

g.set('test_server_match_with_partner_not_found', () => {
    const space = box.space.get('partners');
    const tuple = space.frommap({ id: uuid.new_(), name: 'partner3' });
    luatest.assert_type(tuple, 'cdata');
    luatest.assert_type(space.insert(tuple), 'cdata');
    const resp = httpClient.get(`${httpHost}/match?partner_id=${tuple.id}&user_id=${user1_id}`);
    luatest.assert_equals(resp.status, 404);
    luatest.assert_type(space.delete(tuple.id), 'cdata');
});

g.set('test_server_match_success', () => {
    let resp = httpClient.get(`${httpHost}/match?partner_id=${partner1_id}&user_id=${user2_id}`);
    luatest.assert_equals(resp.status, 200);
    let body = json.decode(resp.body ?? '') as { partner_id: string, timestamp: number };
    luatest.assert_type(body, 'table');
    luatest.assert_equals(body.partner_id, partner1_user2_id.str());
    luatest.assert_type(body.timestamp, 'number');

    resp = httpClient.get(`${httpHost}/match?partner_id=${partner2_id}&user_id=${user2_id}`);
    luatest.assert_equals(resp.status, 200);
    body = json.decode(resp.body ?? '') as { partner_id: string, timestamp: number };
    luatest.assert_type(body, 'table');
    luatest.assert_equals(body.partner_id, partner2_user2_id.str());
    luatest.assert_type(body.timestamp, 'number');
});
