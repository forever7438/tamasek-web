/**
 * 淡马锡网站全局配置文件
 * 集中管理所有重要的URL和配置信息
 */

window.TemasekConfig = {
    // 用户认证相关URL
    auth: {
        loginUrl: '/level/index.html#/login',
        registerUrl: '/level/index.html#/register',
        tradeCenterUrl: '/home/index.html#/market'
    },

    // TSIA相关按钮URL
    tsia: {
        tsiaTlakUrl: 'https://example.com/tsia-tlak',  // TSIA TLAK按钮链接
        tsiaUrl: 'https://example.com/tsia'           // TSIA按钮链接
    },

    // 应用下载链接配置
    downloads: {
        // TSIA TLAK应用下载链接
        tsiaTlak: {
            android: 'https://play.google.com/store/apps/details?id=com.tsiatalk.tsia',
            ios: 'https://apps.apple.com/us/app/tsia-talk/id6751618294'
        },
        // TSIA应用下载链接
        tsia: {
            android: 'https://play.google.com/store/apps/details?id=com.TSIAInfinity.www',
            ios: 'https://apps.apple.com/us/app/tsiainfinity/id6751827801'
        }
    },

    // 语言配置
    languages: {
        current: 'zh',
        available: ['zh', 'en'],
        defaultLanguage: 'zh'
    },
};

/**
 * 检查用户是否已登录
 * @returns {boolean} 用户登录状态
 */
window.isUserLoggedIn = function () {
    const token = JSON.parse(localStorage.getItem('user'))?.userInfo?.token;
    return token && token.trim() !== '';
};

/**
 * 获取当前页面语言
 * @returns {string} 当前语言代码
 */
window.getCurrentLanguage = function () {
    const path = window.location.pathname;
    if (path.startsWith('/zh/')) {
        return 'zh';
    }
    return 'en';
};

/**
 * 获取登录URL
 * @returns {string} 登录页面URL
 */
window.getLoginUrl = function () {
    return window.TemasekConfig.auth.loginUrl;
};

/**
 * 获取注册URL
 * @returns {string} 注册页面URL
 */
window.getRegisterUrl = function () {
    return window.TemasekConfig.auth.registerUrl;
};

/**
 * 获取交易中心URL
 * @returns {string} 交易中心页面URL
 */
window.getTradeCenterUrl = function () {
    return window.TemasekConfig.auth.tradeCenterUrl;
};

/**
 * 获取TSIA TLAK按钮URL
 * @returns {string} TSIA TLAK页面URL
 */
window.getTsiaTlakUrl = function () {
    return window.TemasekConfig.tsia.tsiaTlakUrl;
};

/**
 * 获取TSIA按钮URL
 * @returns {string} TSIA页面URL
 */
window.getTsiaUrl = function () {
    return window.TemasekConfig.tsia.tsiaUrl;
};

/**
 * 获取TSIA TLAK Android下载链接
 * @returns {string} TSIA TALK Android下载URL
 */
window.getTsiaTlakAndroidUrl = function () {
    return window.TemasekConfig.downloads.tsiaTlak.android;
};

/**
 * 获取TSIA TLAK iOS下载链接
 * @returns {string} TSIA TALK iOS下载URL
 */
window.getTsiaTlakIosUrl = function () {
    return window.TemasekConfig.downloads.tsiaTlak.ios;
};

/**
 * 获取TSIA Android下载链接
 * @returns {string} TSIA Android下载URL
 */
window.getTsiaAndroidUrl = function () {
    return window.TemasekConfig.downloads.tsia.android;
};

/**
 * 获取TSIA iOS下载链接
 * @returns {string} TSIA iOS下载URL
 */
window.getTsiaIosUrl = function () {
    return window.TemasekConfig.downloads.tsia.ios;
};

/**
 * 获取应用下载链接
 * @param {string} appType 应用类型 ('tsiaTlak' 或 'tsia')
 * @param {string} platform 平台类型 ('android' 或 'ios')
 * @returns {string} 下载链接URL
 */
window.getDownloadUrl = function (appType, platform) {
    const downloads = window.TemasekConfig.downloads;
    if (downloads[appType] && downloads[appType][platform]) {
        return downloads[appType][platform];
    }
    console.warn(`Download URL not found for ${appType} ${platform}`);
    return '#';
};

/**
 * 退出登录
 */
window.logout = function () {
    localStorage.removeItem('user');
    // 刷新页面以更新按钮状态
    window.location.reload();
};

/**
 * 获取按钮文本配置
 * @param {boolean} isLoggedIn 是否已登录
 * @param {string} language 当前语言
 * @returns {object} 按钮文本配置
 */
window.getButtonTexts = function (isLoggedIn, language) {
    if (language === 'zh') {
        return isLoggedIn ?
            { first: '交易中心', second: '退出' } :
            { first: '登录', second: '注册' };
    } else {
        return isLoggedIn ?
            { first: 'Trade Center', second: 'Logout' } :
            { first: 'LOGIN', second: 'REGISTER' };
    }
};

/**
 * 更新认证按钮链接
 * 在页面加载后自动调用，更新登录和注册按钮的链接和文本
 */
window.updateAuthButtons = function () {
    const isLoggedIn = window.isUserLoggedIn();
    const currentLanguage = window.getCurrentLanguage();
    const buttonTexts = window.getButtonTexts(isLoggedIn, currentLanguage);

    // 更新第一个按钮（登录/交易中心）
    const firstButtons = document.querySelectorAll('.link-login-btn, a[class*="link-login"]');
    firstButtons.forEach(button => {
        if (button) {
            button.textContent = buttonTexts.first;
            if (isLoggedIn) {
                // 已登录：交易中心按钮，点击跳转到登录页面
                button.href = window.getTradeCenterUrl();
                button.onclick = null; // 清除之前可能的点击事件
            } else {
                // 未登录：登录按钮
                button.href = window.getLoginUrl();
                button.onclick = null; // 清除之前可能的点击事件
            }
        }
    });

    // 更新第二个按钮（注册/退出）
    const secondButtons = document.querySelectorAll('.link-register-btn, a[class*="link-register"]');
    secondButtons.forEach(button => {
        if (button) {
            button.textContent = buttonTexts.second;
            if (isLoggedIn) {
                // 已登录：退出按钮
                const loginUrl = window.getLoginUrl();
                if (button.tagName && button.tagName.toLowerCase() === 'a') {
                    // 对于 <a>，使用原生跳转，避免移动端阻止默认行为导致无反应
                    button.href = loginUrl;
                    button.onclick = function () {
                        window.logout();
                        // 不阻止默认行为，交给 <a> 完成跳转
                    };
                } else {
                    // 非 <a> 元素，显式处理跳转，并兼容触控事件
                    const handler = function (e) {
                        if (e && e.preventDefault) e.preventDefault();
                        if (e && e.stopPropagation) e.stopPropagation();
                        window.logout();
                        window.location.href = loginUrl;
                    };
                    button.onclick = handler;
                    if (button.addEventListener) {
                        button.addEventListener('touchend', handler, { passive: false });
                    }
                }
            } else {
                // 未登录：注册按钮
                button.href = window.getRegisterUrl();
                button.onclick = null; // 清除之前可能的点击事件
            }
        }
    });

    // 更新TSIA TLAK按钮
    const tsiaTlakButtons = document.querySelectorAll('.tsia-tlak-btn');
    tsiaTlakButtons.forEach(button => {
        if (button) {
            button.href = window.getTsiaTlakUrl();
        }
    });

    // 更新TSIA按钮
    const tsiaButtons = document.querySelectorAll('.tsia-btn');
    tsiaButtons.forEach(button => {
        if (button) {
            button.href = window.getTsiaUrl();
        }
    });
};

// 页面加载完成后自动更新按钮链接
document.addEventListener('DOMContentLoaded', function () {
    window.updateAuthButtons();
});

// 支持页面动态加载的情况
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.updateAuthButtons);
} else {
    // DOM已经加载完成
    window.updateAuthButtons();
}
