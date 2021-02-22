const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { readDeploymentFile, saveDeploymentFile } = require('../utils/deploymentFile');
const { getContractBytecodeHash } = require('../utils/getBytecodeHash');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACTS } = require('../task-names');

let _hre;

/*
 * Deploys a single contract.
 * */
subtask(SUBTASK_DEPLOY_CONTRACTS).setAction(
  async ({ contractNames, areModules = false, force = false }, hre) => {
    _hre = hre;

    const deploymentsInfo = await _evaluateDeployments({ contractNames, areModules, force });
    await _confirmDeployments({ contractNames, deploymentsInfo });

    await _deployContracts({ contractNames, areModules, deploymentsInfo });
  }
);

async function _evaluateDeployments({ contractNames, areModules, force }) {
  const deploymentsInfo = {};

  let data = readDeploymentFile({ hre: _hre });
  data = areModules ? data.modules : data;

  for (let contractName of contractNames) {
    if (force) {
      deploymentsInfo[contractName] = 'force is set to true';
      continue;
    }

    if (_hre.network.name === 'hardhat') {
      deploymentsInfo[contractName] = 'always deploy in hardhat network';
      continue;
    }

    const deployedData = data[contractName];
    if (!deployedData.deployedAddress) {
      deploymentsInfo[contractName] = 'no previous deployment found';
      continue;
    }

    const sourceBytecodeHash = getContractBytecodeHash({
      contractName: contractName,
      isModule: areModules,
      hre: _hre,
    });
    const storedBytecodeHash = deployedData.bytecodeHash;
    const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
    if (bytecodeChanged) {
      deploymentsInfo[contractName] = 'bytecode changed';
      continue;
    }
  }

  return deploymentsInfo;
}

async function _confirmDeployments({ contractNames, deploymentsInfo }) {
  for (let contractName of contractNames) {
    const reason = deploymentsInfo[contractName];

    if (reason) {
      logger.notice(`${contractName} needs deployment - reason: ${deploymentsInfo[contractName]}`);
    } else {
      logger.checked(`${contractName} does not need to be deployed`);
    }
  }

  const numDeployments = Object.keys(deploymentsInfo).length;
  if (numDeployments === 0) {
    return;
  }

  await prompter.confirmAction('Deploy these contracts');
}

async function _deployContracts({ contractNames, deploymentsInfo, areModules }) {
  for (let contractName of contractNames) {
    const factory = await _hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy();

    const reason = deploymentsInfo[contractName];
    if (!reason) {
      continue;
    }

    if (!contract.address) {
      throw new Error(`Error deploying ${contractName}`);
    }

    logger.success(`Deployed ${contractName} to ${contract.address}`);

    const data = readDeploymentFile({ hre: _hre });
    const target = areModules ? data.modules : data;

    target[contractName] = {
      deployedAddress: contract.address,
      bytecodeHash: getContractBytecodeHash({ contractName, isModule: areModules, hre: _hre }),
    };

    saveDeploymentFile({ data, hre: _hre });
  }
}
