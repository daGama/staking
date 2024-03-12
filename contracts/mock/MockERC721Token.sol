// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721Token is ERC721 {
    constructor() ERC721("MockERC721", "MTK") {
        _mint(msg.sender, 0x00);
        _mint(msg.sender, 0x01);
        _mint(msg.sender, 0x02);
    }

    function mint(uint tokenId) public returns(bool) {

        _safeMint(msg.sender, tokenId);
        return true;
    }
}
