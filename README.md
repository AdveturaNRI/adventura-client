# Welcome to your Expo app 👋

## Production deployment

Pushes to `main` run `.github/workflows/deploy-production.yml`: it builds an
immutable Docker image, publishes it to Docker Hub, then updates only the
`adventura_web` Docker Swarm service by digest.

Add these GitHub Actions secrets before the first push:

- `DOCKERHUB_USERNAME` — `moskowpsix`.
- `DOCKERHUB_TOKEN` — Docker Hub access token with read/write access.
- `DEPLOY_HOST`, `DEPLOY_PORT` (optional; defaults to `22`) and `DEPLOY_USER`.
- `DEPLOY_PASSWORD` — password for the deployment user permitted to run
  `docker service update` on the Swarm manager.
- `SWARM_SERVICE` — name of the frontend Swarm service; use `adventura_web`
  for the `web` service in the `adventura` stack.
- `DEPLOY_KNOWN_HOSTS` — verified ED25519 host key prefixed with
  `adventura-deploy`, for example `adventura-deploy ssh-ed25519 AAAA...`.
  Obtain and verify its SSH host fingerprint out of band; do not disable host
  key checking in the workflow.

The Swarm stack must contain a service named `web` in the `adventura` stack
(therefore `adventura_web`). The deployment workflow updates its image only;
it does not redeploy PostgreSQL, migrations, or the API. If the Docker Hub
repository is private, log the Swarm manager into Docker Hub once before the
first deploy.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
