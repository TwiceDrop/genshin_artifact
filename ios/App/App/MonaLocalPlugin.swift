import Capacitor
import Foundation
import Security
import UIKit
import UniformTypeIdentifiers

@objc(MonaLocalPlugin)
public final class MonaLocalPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "MonaLocalPlugin"
    public let jsName = "MonaLocal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise)
    ]

    private static let emptyVault = "{\"version\":1,\"accounts\":[]}"
    private var exportCall: CAPPluginCall?
    private var exportDirectory: URL?

    private var vaultQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.mona.artifact.local.vault",
            kSecAttrAccount as String: "mona-cookie-v1"
        ]
    }

    @objc public func readVault(_ call: CAPPluginCall) {
        var query = vaultQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve(["text": Self.emptyVault])
            return
        }
        guard status == errSecSuccess,
              let data = result as? Data,
              let text = String(data: data, encoding: .utf8) else {
            call.reject("无法读取本机加密 Cookie 库；原数据未修改")
            return
        }
        call.resolve(["text": text])
    }

    @objc public func writeVault(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), text.utf16.count <= 2_000_000,
              let data = text.data(using: .utf8) else {
            call.reject("Cookie 库格式无效")
            return
        }

        var attributes = vaultQuery
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        var status = SecItemAdd(attributes as CFDictionary, nil)
        if status == errSecDuplicateItem {
            status = SecItemUpdate(vaultQuery as CFDictionary, [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            ] as CFDictionary)
        }
        if status == errSecSuccess {
            call.resolve()
        } else {
            call.reject("Cookie 保存失败，请检查设备存储空间")
        }
    }

    @objc public func saveFile(_ call: CAPPluginCall) {
        let data: Data
        if let encoded = call.getString("base64") {
            guard let decoded = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters) else {
                call.reject("文件内容无效")
                return
            }
            data = decoded
        } else if let text = call.getString("text") {
            data = Data(text.utf8)
        } else {
            call.reject("文件内容为空")
            return
        }

        let mimeType = call.getString("mimeType") ?? "application/json"
        let requestedName = call.getString("filename") ?? "mona-backup.json"
        let basename = URL(fileURLWithPath: requestedName.replacingOccurrences(of: "\\", with: "/")).lastPathComponent
        var filename = basename.isEmpty || basename == "." || basename == ".." ? "mona-backup.json" : basename
        if URL(fileURLWithPath: filename).pathExtension.isEmpty,
           let ext = UTType(mimeType: mimeType)?.preferredFilenameExtension {
            filename += ".\(ext)"
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("无法保存文件，请重新选择位置")
                return
            }
            guard self.exportCall == nil else {
                call.reject("请先完成当前文件导出")
                return
            }
            guard var presenter = self.bridge?.viewController else {
                call.reject("无法保存文件，请重新选择位置")
                return
            }
            while let presented = presenter.presentedViewController {
                presenter = presented
            }

            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("mona-export-\(UUID().uuidString)", isDirectory: true)
            let file = directory.appendingPathComponent(filename, isDirectory: false)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: file, options: .atomic)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                call.reject("无法保存文件，请重新选择位置")
                return
            }

            self.exportDirectory = directory
            self.exportCall = call
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        completeExport(urls.isEmpty ? ["cancelled": true] : ["saved": true])
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        completeExport(["cancelled": true])
    }

    private func completeExport(_ result: [String: Bool]) {
        exportCall?.resolve(result)
        exportCall = nil
        if let directory = exportDirectory {
            try? FileManager.default.removeItem(at: directory)
            exportDirectory = nil
        }
    }
}
