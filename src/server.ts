import * as http_server from 'http.server';
import { TupleObject, rocks } from 'tarantoolscript';
import * as uuid from 'uuid';
import { Box } from 'tarantoolscript';
import * as json from 'json';

type Request = rocks.HttpRequest;
type Response = rocks.HttpResponse;

declare const box: Box;

function handlerSync(this: void, req: Request): Response {
    const resp = {} as Response;
    resp.headers?.set('Access-Control-Allow-Credentials', 'true');

    if (req.headers.has('origin')) {
        resp.headers?.set('Access-Control-Allow-Origin', req.headers.get('origin'));
    }

    const partner_id = uuid.fromstr(req.stash('partner_id') as string || '');
    const partner_user_id = req.stash('partner_user_id');
    let user_id = uuid.fromstr(req.cookie('user_id') || '');

    if (!user_id) {
        user_id = uuid.new_();
        http_server.internal.response_mt.__index.setcookie(resp, {
            name: 'user_id',
            value: user_id.str(),
            path: '/',
            expires: '+1y',
        });
    }

    if (!partner_id) {
        return resp;
    }

    const partner = box.space.get('partners').get(partner_id);
    if (!partner) {
        return resp;
    }

    const timestamp = os.time(os.date('*t'));
    const space = box.space.get('matches');
    let match = space.get(user_id);

    let insert = false;
    if (!match) {
        match = space.frommap({ id: user_id, partner_ids: {} });
        insert = true;
    }

    match.partner_ids[partner.id.str()] = { id: partner_user_id, timestamp: timestamp };
    if (insert) {
        space.insert(match);
    } else {
        space.replace(match);
    }

    return resp;
}

function handlerMatch(this: void, req: Request): Response {
    const resp = {} as Response;
    const user_id = uuid.fromstr(req.param('user_id') as string || '');
    const partner_id = uuid.fromstr(req.param('partner_id') as string || '');

    if (!user_id || !partner_id) {
        resp.status = 400;
        resp.body = 'user_id or partner_id should be a uuid string';
        return resp;
    }

    const partner = box.space.get('partners').get(partner_id);
    if (!partner) {
        resp.status = 404;
        resp.body = `partner with id ${partner_id.str()} not found`;
        return resp;
    }

    const tuple = box.space.get('matches').get(user_id);
    if (!tuple) {
        resp.status = 404;
        resp.body = `user with id ${user_id.str()} not found`;
        return resp;
    }

    const partner_match = tuple.partner_ids[partner.id.str()];
    if (!partner_match) {
        resp.status = 404;
        resp.body = `user ${user_id.str()} don't have matching with partner ${partner_id.str()}`;
        return resp;
    }

    resp.headers = { ['Content-Type']: 'application/json; charset=utf-8' } as unknown as LuaTable<string, string>;
    resp.body = json.encode({
        partner_id: partner_match.id,
        timestamp: partner_match.timestamp,
    });

    return resp;
}

function partnersPost(this: void, req: Request): Response {
    const resp = {} as Response;
    const body = req.json() as LuaTable<string, unknown>;

    const id = uuid.fromstr(body.get('id') as string || '');
    if (!id) {
        resp.status = 404;
        resp.body = 'id should be a uuid string';
        return resp;
    }

    const name = body.get('name');
    if (!name || name == '') {
        resp.status = 404;
        resp.body = 'name cannot be empty';
        return resp;
    }

    const space = box.space.get('partners');
    let tuple = space.frommap({ id, name });
    tuple = space.insert(tuple);
    resp.body = json.encode(tuple.tomap({ names_only: true }));
    resp.headers = { ['Content-Type']: 'application/json; charset=utf-8' } as unknown as LuaTable<string, string>;
    return resp;
}

function partnersGet(this: void, req: Request): Response {
    const resp = {} as Response;
    const space = box.space.get('partners');
    const partner_id = uuid.fromstr(req.stash('partner_id') as string || '');

    if (!partner_id) {
        const [tuples] = space.select();
        resp.body = json.encode(tuples?.map(t => t.tomap({ names_only: true })) || []);
        resp.headers = { ['Content-Type']: 'application/json; charset=utf-8' } as unknown as LuaTable<string, string>;
        return resp;
    }

    const tuple = space.get(partner_id);
    if (!tuple) {
        resp.status = 404;
        resp.body = `partner with id ${partner_id.str()} not found`;
        return resp;
    }

    resp.body = json.encode(tuple.tomap({ names_only: true }));
    resp.headers = { ['Content-Type']: 'application/json; charset=utf-8' } as unknown as LuaTable<string, string>;
    return resp;
}

function partnersDelete(this: void, req: Request): Response {
    const resp = {} as Response;
    const partner_id = uuid.fromstr(req.stash('partner_id') as string || '');
    const space = box.space.get('partners');

    let tuple: TupleObject | null;
    if (space['engine'] == 'vinyl') {
        tuple = space.get(partner_id);
        if (tuple) {
            space.delete(partner_id);
        }
    } else {
        tuple = space.delete(partner_id);
    }

    if (!tuple) {
        resp.status = 404;
        resp.body = `partner with id ${partner_id} not found`;
        return resp;
    }

    resp.body = json.encode(tuple.tomap({ names_only: true }));
    resp.headers = { ['Content-Type']: 'application/json; charset=utf-8' } as unknown as LuaTable<string, string>;
    return resp;
}

function handlerPartners(this: void, req: Request): Response {
    switch (req.method) {
        case 'POST':
            return partnersPost(req);
        case 'GET':
            return partnersGet(req);
        case 'DELETE':
            return partnersDelete(req);
    }

    return {
        status: 405,
        body: 'method not allowed',
    };
}

export function serve(this: void, host: string, port: number, logRequests: boolean): void {
    const httpd = http_server.new_(host, port, {
        log_requests: logRequests,
    });

    httpd.route({ path: '/sync/:partner_id/:partner_user_id', method: 'GET' }, handlerSync);
    httpd.route({ path: '/match', method: 'GET' }, handlerMatch);
    httpd.route({ path: '/partners', method: 'GET' }, handlerPartners);
    httpd.route({ path: '/partners', method: 'POST' }, handlerPartners);
    httpd.route({ path: '/partners/:partner_id', method: 'GET' }, handlerPartners);
    httpd.route({ path: '/partners/:partner_id', method: 'DELETE' }, handlerPartners);
    httpd.start();
}
