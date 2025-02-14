# reciprocity

A app to find love ❤️


## setup

basic:
```sh
npm install
cp .env.example .env
# edit .env to put proper values in

# for local dev
supabase init
supabase start
# copy the DATABASE_URL printed to .env

# and apply the latest db migrations to create all tables (or migrate if something exists)
DATABASE_URL=... npm run db:migrate
```

for discord oauth stuff go to https://discord.com/developers, create an application, copy the client id and secret, and put them in .env.


for final deployment:
- use https://railway.com/ (literally the best)
- create a postgres instance connected to your app
- copy .env and also make sure the DATABASE_URL set in railway is to the railway DB
- profit

