const mockDirectoryPrefix = "tests/.data/http";
const { setup, createServer } = require("./utils");
const mockFile = setup(mockDirectoryPrefix);

describe("http mock test", function(){
    let axios, server;
    beforeAll(function(done) {
        createServer({
            jsonpCallbackName: "callback",
            mockRules: {
                "/mock": mockDirectoryPrefix,
                "/mock/v2": mockDirectoryPrefix + "/tmp",
                "/directive": mockDirectoryPrefix
            }
        }, function(args){
            ({axios, server} = args);
            done();
        });
    });
    afterAll(function(){
        server.close();
    });
    
    test("ignore request if request url is '/'", function(){
        return expect(
            axios.get("/").catch(e => Promise.reject(e.message))
        ).rejects.toMatch(/404/);
    });
    test("tail / in request url is ignored", function(){
        mockFile("/mock/test.json", "{}");
        return expect(
            axios.get("/mock/test.json/").then(resp => JSON.stringify(resp.data))
        ).resolves.toBe("{}");
    });
    test("return 404 if url not match any url prefix in mockrc.json", function(){
        return expect(
            axios.get("/something").catch(e => Promise.reject(e.message))
        ).rejects.toMatch(/404/);
    });
    test("return 404 if url match any file", function(){
        return expect(
            axios.get("/mock/not/exists").catch(e => Promise.reject(e.message))
        ).rejects.toMatch(/404/);
    });
    test("select longest url prefix if url matches multiple url prefix", function(){
        mockFile("/mock/v2/who.json", "{from: 1}");
        mockFile("/tmp/mock/v2/who.json", "{from: 2}");
        return expect(
            axios.get("/mock/v2/who").then(resp => resp.data.from)
        ).resolves.toBe(2);
    });
    test("invalid json will receive Buffer", function(){
        mockFile("/mock/invalid.json", "xx");
        return expect(
            axios.get("/mock/invalid").then(resp => resp.data)
        ).resolves.toBe("xx");
    });
    test("can serve non json mock file", function(){
        let data = "hello, world!";
        mockFile("/mock/myfile", data);
        return expect(
            axios.get("/mock/myfile").then(resp => resp.data)
        ).resolves.toBe(data);
    });
    test("delay request 1000ms if mock file has '{\"#delay#\": 1000}'", function(){
        mockFile("/directive/delay.json", '{"#delay#":1000}');
        let start = Date.now();
        return expect(
            axios.get("/directive/delay")
            .then(() => (Date.now() - start))
        ).resolves.toBeGreaterThanOrEqual(1000);
    });
    test("kill request if mock file has '{\"#kill#\": true}'", function(){
        mockFile("/directive/kill.json", '{"#kill#": true}');
        return expect(
            axios.get("/directive/kill").catch(e => Promise.reject(e.message))
        ).rejects.toMatch(/Network Error|socket hang up/);
    });
    test("status code is 408 if mock file has '{\"#code#\": 408}'", function(){
        mockFile("/directive/code.json", '{"#code#": 408}');
        return expect(
            axios.get("/directive/code").catch(e => e.response.status)
        ).resolves.toBe(408);
    });
    test("support jsonp", function(){
        mockFile("/mock/jsonp.json", 'true');
        return expect(
            axios.get("/mock/jsonp?callback=jQueryxxx322332").then(resp => resp.data)
        ).resolves.toBe("jQueryxxx322332(true)");
    });
});
