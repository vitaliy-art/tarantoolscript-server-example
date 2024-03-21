import { Box } from 'tarantoolscript';
import { createUser, migrationsUp } from './schema';
import { config } from './configuration';
import { serve } from './server';

declare const box: Box;

box.cfg({
    listen: config.listen,
    log_level: config.logLevel,
});

createUser(config.userName, config.userPassword);
migrationsUp(config.userName);
serve(config.appHost, config.appPort, config.appLogRequests);
