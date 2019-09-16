# ethPM Plugin

[Documentation](https://docs.ethpm.com/ethpm-developer-guide/ethpm-and-remix-ide)


### Install

Within the [Remix IDE](https://remix.ethereum.org), click on the :electric_plug: symbol to open the plugin manager.

Search for "EthPM" and hit "Activate".

### Usage

1. Generate an ethPM package from smart contracts in your Remix editor.
2. Import smart contracts / deployed contract instances from ethPM packages.

## Contributing

`npm install` then `npm run serve`

In the plugin manager in [Remix (alpha)](http://remix-alpha.ethereum.org), select "Connect a local plugin"

## Developing

Now that you're ready to develop, there are two methods, but no real advantage for either. One issue I had was not being able to connect to my plugin, even though it was running. Switching between methods helped as a sanity check.

1. [Remix-alpha.ethereum.org](https://Remix-alpha.ethereum.org) allows you to add a local plugin. This is also where your plugin will appear once it has been completed and approved.
2. Host the remix IDE locally so you can code on the :airplane:

## Publishing

Create a profile for your plugin using the correct keys in [the profile doc](https://github.com/ethereum/remix-plugin/blob/master/doc/deploy/profile.md). Then make a PR on `src/remixAppManager.js` [in the remix-ide repo](https://github.com/ethereum/remix-ide/blob/8d3a09f9b19060509d2789ced8e8d5ee6c9f6e9f/src/remixAppManager.js). Remember it will appear on remix-alpha first, before going to production. I have no idea what the process is for this :confused:


## Shoutouts
Forked from [pi0neerpat's OneClickDapp](https://github.com/pi0neerpat/remix-plugin-one-click-dapp)
