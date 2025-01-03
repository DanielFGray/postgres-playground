# [Postgres Garden](https://postgres.garden)

a postgres IDE for your browser

## contributing

### prerequisites

- [bun](https://bun.sh/docs/installation)
- [docker](https://docs.docker.com/engine/install/)
- [docker-compose](https://docs.docker.com/compose/install/)

### setup

after cloning the repo

```sh
bun i
bun setup
```

the `setup` script will generate a `.env` file, launch postgres in docker, and run migrations

---

to run the whole dev server

```sh
bun dev
```

to only run the client

```sh
bun dev:client
```

or to only run the backend server

```sh
bun dev:server
```
