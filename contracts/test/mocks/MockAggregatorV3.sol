// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";

contract MockAggregatorV3 is IAggregatorV3 {
    uint8 public override decimals;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint8 decimals_, int256 initialAnswer) {
        decimals = decimals_;
        answer = initialAnswer;
        updatedAt = block.timestamp;
    }

    function setLatest(int256 newAnswer, uint256 newUpdatedAt) external {
        answer = newAnswer;
        updatedAt = newUpdatedAt;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 ans, uint256 startedAt, uint256 upd, uint80 answeredInRound)
    {
        return (1, answer, 0, updatedAt, 1);
    }
}
