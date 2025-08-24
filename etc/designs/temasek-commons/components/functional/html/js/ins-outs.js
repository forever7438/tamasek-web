/*jslint fudge: true, browser: true */
/*global WOW, is, jQuery, window */

jQuery(function ($) {
    "use strict";

    function initializeTabs() {
        $(".tabs-header a").on("click", function (event) {
            event.preventDefault();
            var anchor = event.currentTarget;
            var elementID = anchor.getAttribute("href");

            $(".tabs-header a").removeClass("active");
            $(".tabs-content").removeClass("active");

            $(anchor).addClass("active");
            $(elementID).addClass("active");
        });
    }

    function suitableEventType() {
        try {
            window.document.createEvent("TouchEvent");
            return "click";
        } catch (ignore) {
            return "hover";
        }
    }

    function initializeTooltips() {
        if ($(".tooltip").length) {
            $(".tooltip").tooltipster({
                interactive: true,
                contentAsHTML: true,
                maxWidth: 300,
                contentCloning: true,
                trigger: suitableEventType()
            });
        }
    }

    var buttonId = "";
    function initializeMobileToggle() {
        $(".funnel-wrapper button").on("click", function (event) {
            var $button = $(event.currentTarget);
            if (buttonId && buttonId === $button.data("show")) {
                $("#" + buttonId).slideToggle("slow");
                $(".funnel-wrapper > ul img").toggleClass("fade-img");
                $button.toggleClass("active");
                $button.next().toggleClass("fade-img");
            } else {
                buttonId = $button.data("show");
                $(".funnel-wrapper button").removeClass("active");
                $(".funnel-wrapper > ul img").addClass("fade-img");
                $button.addClass("active");
                $button.next().removeClass("fade-img");
                $(".detail-box").hide();
                $("#" + buttonId).slideDown("slow");
            }
        });
    }

    function initializeDropTabs() {
        $(".element").on("click touch", function (event) {
            event.preventDefault();
            var $element = $(event.currentTarget);
            var $elementBody = $element.find(".element-body");
            if ($elementBody.hasClass("active")) {
                $elementBody.removeClass("active");
            } else {
                $(".element-body").removeClass("active");
                $elementBody.addClass("active");
            }
            event.stopPropagation();
        });
    }

    initializeDropTabs();
    initializeTabs();
    initializeMobileToggle();
    initializeTooltips();
    new WOW().init();

    if (is.ie()) {
        $(".arrow:not(.shorten)").css({
            "position": "absolute",
            "z-index": "-1",
            "height": "155px",
            "top": "189px"
        });
    }

});
