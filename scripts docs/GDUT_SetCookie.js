// GDUT_SetCookie.js
// Scriptable for iOS

const KEYCHAIN_KEY = "GDUT_JSESSIONID"

const inputAlert = new Alert()
inputAlert.title = "保存 JSESSIONID"
inputAlert.message = "请输入广东工业大学教务系统的 JSESSIONID"
inputAlert.addTextField("JSESSIONID")
inputAlert.addAction("保存")
inputAlert.addCancelAction("取消")

const action = await inputAlert.presentAlert()

if (action === -1) {
  const cancelAlert = new Alert()
  cancelAlert.message = "未保存"
  cancelAlert.addAction("确定")
  await cancelAlert.presentAlert()
} else {
  const jsessionid = inputAlert.textFieldValue(0)
  Keychain.set(KEYCHAIN_KEY, jsessionid)

  const successAlert = new Alert()
  successAlert.message = "JSESSIONID 已保存"
  successAlert.addAction("确定")
  await successAlert.presentAlert()
}
