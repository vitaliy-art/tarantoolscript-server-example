import * as http_server from 'http.server';
import { rocks } from 'tarantoolscript';
import * as uuid from 'uuid';
import { Box } from 'tarantoolscript';

type Request = rocks.HttpRequest;
type Response = rocks.HttpResponse;

declare const box: Box;

const handlePartnerId = function (this: void, req: Request): Response {
    const resp = {} as Response;
    resp.headers?.set('Access-Control-Allow-Credentials', 'true');

    if (req.headers.has('origin')) {
        resp.headers?.set('Access-Control-Allow-Origin', req.headers.get('origin'));
    }

    const partner_id = req.stash('partner_id');
    const partner_user_id = req.stash('partner_user_id');
    let user_id = req.cookie('user_id');

    if (!user_id || !uuid.is_uuid(user_id)) {
        user_id = uuid.new_().str();
        http_server.internal.response_mt.__index.setcookie(resp, {
            name: 'user_id',
            value: user_id,
            path: '/',
            expires: '+1y',
        });
    }

    if (!partner_id || !uuid.is_uuid(partner_id)) {
        return resp;
    }

    const partner = box.space.get('partners').get([partner_id]);
    if (!partner) {
        return resp;
    }

    const timestamp = os.time(os.date('*t'));
    const space = box.space.get('matches');
    let match = space.get([user_id]);

    let insert = false;
    if (!match) {
        match = space.frommap({ id: user_id, partner_ids: {} });
        insert = true;
    }

    match.partner_ids[partner.id] = { id: partner_user_id, timestamp: timestamp };
    if (insert) {
        space.insert(match);
    } else {
        space.replace(match);
    }

    return resp;
};

const handleMatch = function (this: void, req: Request): Response {
    const resp = {} as Response;
    const user_id = req.param('user_id');
    const partner_id = req.param('partner_id');

    if (!uuid.is_uuid(user_id) || !uuid.is_uuid(partner_id)) {
        resp.status = 400;
        resp.body = 'user_id or partner_id should be a uuid string';
        return resp;
    }

    const partner = box.space.get('partners').get([partner_id]);
    if (!partner) {
        resp.status = 404;
        resp.body = `partner with id ${partner_id} not found`;
        return resp;
    }

    const tuple = box.space.get('matches').get([user_id]);
    if (!tuple) {
        resp.status = 404;
        resp.body = `user with id ${user_id} not found`;
        return resp;
    }

    const partner_match = tuple.partner_ids[partner.id];
    if (!partner_match) {
        resp.status = 404;
        resp.body = `user ${user_id} don't have matching with partner ${partner_id}`;
        return resp;
    }

    resp.body = {
        partner_id: partner_match.id,
        timestamp: partner_match.timestamp,
    };

    return resp;
};

export function serve(this: void, host: string, port: number, logRequests: boolean): void {
    const httpd = http_server.new_(host, port, {
        log_requests: logRequests,
    });

    httpd.route({ path: '/sync/:partner_id/:partner_user_id' }, handlePartnerId);
    httpd.route({ path: '/match' }, handleMatch);
    httpd.start();
}
