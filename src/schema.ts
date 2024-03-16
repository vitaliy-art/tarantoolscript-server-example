import { Box } from 'tarantoolscript';

declare const box: Box;

interface Migration {
    name: string;
    up: (this: Migration, userName: string) => void;
    down: (this: Migration) => void;

}

const migrations: Migration[] = [
    {
        name: '_create_partners',
        up: function (this: Migration, userName: string): void {
            box.once(this.name, () => {
                const space = box.schema.space.create('partners', {
                    if_not_exists: true,
                    engine: 'memtx',
                    user: userName,
                });

                space.format([
                    { name: 'id', type: 'uuid' },
                    { name: 'name', type: 'string' },
                ]);

                space.create_index('primary', {
                    unique: true,
                    if_not_exists: true,
                    parts: ['id'],
                });

                box.space._schema.delete(`once${this.name}_down`);
            });
        },
        down: function (this: Migration): void {
            box.once(`${this.name}_down`, () => {
                box.space.get('partners').drop();
                box.space._schema.delete(`once${this.name}`);
            });
        },
    },
    {
        name: '_create_matches',
        up: function (this: Migration, userName: string): void {
            box.once(this.name, () => {
                const space = box.schema.space.create('matches', {
                    if_not_exists: true,
                    engine: 'vinyl',
                    user: userName,
                });

                space.format([
                    { name: 'id', type: 'uuid' },
                    { name: 'partner_ids', type: 'map' },
                ]);

                space.create_index('primary', {
                    unique: true,
                    if_not_exists: true,
                    parts: ['id'],
                });

                box.space._schema.delete(`once${this.name}_down`);
            });
        },
        down: function (this: Migration): void {
            box.once(`${this.name}_down`, () => {
                box.space.get('matches').drop();
                box.space._schema.delete(`once${this.name}`);
            });
        },
    },
];

export function migrationsUp(this: void, userName: string): void {
    for (const m of migrations) {
        m.up(userName);
    }
}

export function migrationsDown(this: void): void {
    for (const m of migrations.reverse()) {
        m.down();
    }
}

export function createUser(this: void, userName: string, userPassword: string): void {
    box.once(`_create_user_${userName}`, () => {
        box.schema.user.create(userName, {
            if_not_exists: true,
            password: userPassword,
        });

        box.schema.user.grant(userName, 'read,write,execute', 'universe');
    });
}
