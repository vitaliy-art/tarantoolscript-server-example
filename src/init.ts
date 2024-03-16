import { Box } from 'tarantoolscript';
import { createUser, migrationsUp } from './schema';
import { config } from './configuration';

declare const box: Box;

box.cfg({
    listen: 3302,
});

createUser(config.userName, config.userPassword);
migrationsUp(config.userName);
