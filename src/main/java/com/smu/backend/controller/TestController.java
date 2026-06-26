package com.smu.backend.controller;

import com.smu.backend.service.SwmmService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin; // 🌟 이거 임포트 추가!

@RestController
@CrossOrigin(origins = "*") // 🌟 "모든 프론트엔드 포트의 접근을 허락하노라!" 라는 뜻
public class TestController {

    @Autowired
    private SwmmService swmmService;

    @GetMapping("/api/test/swmm")
    public Object testSwmmConnection(@RequestParam(defaultValue = "100.0") double rainfall) {
        System.out.println("🚀 [Spring] 파이썬 서버로 강우량 " + rainfall + "mm/h 계산 요청!");
        return swmmService.runSimulation(rainfall);
    }
}