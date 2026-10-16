import XCTest
@testable import Vxin

final class StartupConfigTests: XCTestCase {
    private let manualKey = "vxin_base_url_override"
    private let remoteKey = "vxin_base_url_remote"
    private var priorManual: String?
    private var priorRemote: String?

    override func setUp() {
        priorManual = UserDefaults.standard.string(forKey: manualKey)
        priorRemote = UserDefaults.standard.string(forKey: remoteKey)
        UserDefaults.standard.removeObject(forKey: manualKey)
        UserDefaults.standard.removeObject(forKey: remoteKey)
    }

    override func tearDown() {
        if let priorManual { UserDefaults.standard.set(priorManual, forKey: manualKey) }
        else { UserDefaults.standard.removeObject(forKey: manualKey) }
        if let priorRemote { UserDefaults.standard.set(priorRemote, forKey: remoteKey) }
        else { UserDefaults.standard.removeObject(forKey: remoteKey) }
    }

    func testRetiredCachedServerFallsBackToCurrentBackend() {
        UserDefaults.standard.set("https://liaotian99.com", forKey: remoteKey)
        XCTAssertEqual(ServerConfig.shared.baseURL, "https://vxinchat.com")
        XCTAssertNil(UserDefaults.standard.string(forKey: remoteKey))
    }

    func testRetiredManualServerIsClearedButCustomServerIsPreserved() {
        UserDefaults.standard.set("https://liaotian99.com", forKey: manualKey)
        XCTAssertEqual(ServerConfig.shared.baseURL, "https://vxinchat.com")
        XCTAssertNil(UserDefaults.standard.string(forKey: manualKey))

        ServerConfig.shared.baseURL = "https://custom.example"
        XCTAssertEqual(ServerConfig.shared.baseURL, "https://custom.example")
    }
}
