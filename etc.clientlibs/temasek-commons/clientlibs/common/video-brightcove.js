/*jslint browser: true, fudge: true, long: true */
/*global blacksunplc, document, jQuery */

jQuery(function ($) {
    "use strict";

    var arrays = blacksunplc.arrays; // import * as arrays from "module:blacksunplc/arrays"
    var jsonml = blacksunplc.jsonml; // import * as jsonml from "module:blacksunplc/jsonml"

    var scriptPaths = [];

    arrays.forEach($("video.video-js"), function (video) {
        var $video = $(video);
        var accountId = $video.data("account");
        var playerId = $video.data("player");

        if (!accountId || !playerId) {
            return;
        }

        var scriptPath = "https://players.brightcove.net/" + accountId + "/" + playerId + "_default/index.min.js";

        if (!arrays.includes(scriptPaths, scriptPath)) {
            scriptPaths.push(scriptPath);
        }
    });

    var head = /** @type {!HTMLHeadElement} */ (document.querySelector("head"));
    arrays.forEach(scriptPaths, function (scriptSrc) {
        jsonml.append(head, ["script", {"src": scriptSrc}]);
    });

});
