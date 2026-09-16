import XCTest
@testable import Vxin

final class ScopedMessageStoresTests: XCTestCase {
    private let a = MessageScope(server: "https://one.invalid", userId: "alice", credential: "token-a")
    private let b = MessageScope(server: "https://one.invalid", userId: "bob", credential: "token-b")
    private var current: MessageScope?
    private var defaults: UserDefaults!
    private var suite: String!

    override func setUp() {
        suite = "vxin_scope_test_\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)!
        current = a
    }
    override func tearDown() { defaults.removePersistentDomain(forName: suite) }

    private func pending(_ sender: String, id: String = "pending") -> Message {
        Message(optimisticText: id, conversationId: "group", senderId: sender, content: "私密消息", replyToId: nil, replyTo: nil, clientMsgId: id)
    }

    func testNamespacesSeparateServersAndAccountsButNotTokenRefresh() {
        XCTAssertNotEqual(a.key, b.key)
        XCTAssertNotEqual(a.key, MessageScope(server: "https://two.invalid", userId: "alice", credential: "token-a").key)
        XCTAssertEqual(a.key, MessageScope(server: a.server, userId: a.userId, credential: "new-token").key)
        XCTAssertNotEqual(a, MessageScope(server: a.server, userId: a.userId, credential: "new-token"))
        XCTAssertFalse(a.owns(senderId: "bob", messageConversationId: "group", conversationId: "group"))
    }

    func testDraftsRejectLegacyAndStaleAccountWrites() {
        let drafts = DraftStore(defaults: defaults, currentScope: { [unowned self] in current })
        defaults.set("legacy secret", forKey: "vxin_draft_group")
        XCTAssertEqual(drafts.get("group", scope: a), "")
        drafts.set("group", "你好 👋", scope: a)
        current = b
        XCTAssertEqual(drafts.get("group", scope: b), "")
        drafts.set("group", "old callback", scope: a)
        drafts.set("group", "bob draft", scope: b)
        current = a
        XCTAssertEqual(drafts.get("group", scope: a), "你好 👋")
        drafts.clearScope(a)
        XCTAssertEqual(drafts.get("group", scope: a), "")
        current = b
        XCTAssertEqual(drafts.get("group", scope: b), "bob draft")
        XCTAssertNil(defaults.string(forKey: "vxin_draft_group"))
    }

    func testOutboxRejectsWrongSenderAndExpiredSessionCallbacks() {
        let outbox = OutboxStore(defaults: defaults, currentScope: { [unowned self] in current })
        outbox.upsert("group", pending("alice"), scope: a)
        outbox.upsert("group", pending("bob", id: "poison"), scope: a)
        XCTAssertEqual(outbox.load("group", scope: a).map(\.id), ["pending"])
        current = b
        XCTAssertTrue(outbox.load("group", scope: b).isEmpty)
        outbox.upsert("group", pending("alice"), scope: b)
        outbox.upsert("group", pending("alice"), scope: a)
        XCTAssertTrue(outbox.load("group", scope: b).isEmpty)
        current = a
        XCTAssertEqual(outbox.load("group", scope: a).count, 1)
        outbox.clearScope(a)
        current = nil
        outbox.upsert("group", pending("alice"), scope: a)
        current = a
        XCTAssertTrue(outbox.load("group", scope: a).isEmpty)
    }

    func testHistoryCacheCannotBeReadOrRepopulatedByOldAccount() {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let cache = MsgCacheStore(directory: directory, currentScope: { [unowned self] in current })
        defer { cache.ioQueue.sync {}; try? FileManager.default.removeItem(at: directory) }
        var message = Message(cachedId: "real", conversationId: "group", senderId: "alice")
        message.content = "private"
        cache.save("group", [message], scope: a)
        cache.ioQueue.sync {}
        current = b
        XCTAssertTrue(cache.load("group", scope: b).isEmpty)
        cache.save("group", [message], scope: a)
        cache.ioQueue.sync {}
        XCTAssertTrue(cache.load("group", scope: b).isEmpty)
        current = a
        XCTAssertEqual(cache.load("group", scope: a).first?.content, "private")
        cache.clear()
        cache.ioQueue.sync {}
        XCTAssertTrue(cache.load("group", scope: a).isEmpty)
    }
}
