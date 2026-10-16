/* Service worker des notifications (OneSignal).
   Volontairement séparé de service-worker.js (cache hors ligne) : un seul service
   worker peut être actif par zone, donc celui-ci a sa propre zone /push/onesignal/. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
